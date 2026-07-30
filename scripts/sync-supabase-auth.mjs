// Pushes the auth configuration Airrow owns to the linked Supabase project (spec 113): the email
// templates committed in `supabase/templates/`, the Resend SMTP settings, and the redirect allow-list.
//
// All three are things a dashboard form would otherwise hold as the only copy. Spec 77 was written
// after exactly that arrangement — one fact in two places, kept in step by someone remembering —
// shipped a broken production database. None of these is as dangerous as a schema, but they fail the
// same way: what reviewers approved stops being what founders get, and nothing says so.
//
// `supabase/config.toml` governs the *local* stack; this governs the hosted one. The templates are the
// one input both read.
//
// Usage:
//   SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_ID=… RESEND_API_KEY=… node scripts/sync-supabase-auth.mjs
//   …same, plus --dry-run   → print the request body (secrets redacted) and exit without sending
//
// The Management API field names below are the expected ones. A name the API does not recognise comes
// back as a 4xx with the reason in the body, which the error path prints — so a wrong guess here fails
// loudly rather than silently doing nothing.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TEMPLATES_DIR = new URL("../supabase/templates/", import.meta.url);

/** The canonical origin. Supabase falls back to this when a request passes no `emailRedirectTo`. */
export const SITE_URL = "https://airrow.app";

/**
 * The templates we manage, and the auth-config fields each one lands in.
 *
 * Only the confirmation email today — the rest of the transactional mail (password reset, email
 * change, invite) is deliberately a separate issue, and adding one here is a row plus its HTML file.
 */
export const TEMPLATES = [
  {
    file: "confirmation.html",
    subject: "Confirm your email address",
    subjectField: "mailer_subjects_confirmation",
    contentField: "mailer_templates_confirmation_content"
  }
];

/**
 * Where Supabase will let an auth flow redirect back to.
 *
 * The app decides the same question at request time in `apps/web/src/lib/site-url.ts`, and the two
 * have to agree: a host the app is willing to build a link for but Supabase has not been told about
 * produces a confirmation email whose link is rejected. That pairing is asserted by
 * `sync-supabase-auth.test.mjs` rather than left to whoever edits one of them next.
 *
 * Localhost is absent on purpose — this is the hosted project. Local development is
 * `additional_redirect_urls` in `supabase/config.toml`.
 */
export const REDIRECT_URLS = [
  "https://airrow.app/auth/confirm",
  "https://airrow.app/auth/callback",
  "https://airrow-dev.vercel.app/auth/confirm",
  "https://airrow-dev.vercel.app/auth/callback",
  "https://dev.airrow.app/auth/confirm",
  "https://dev.airrow.app/auth/callback",
  // Preview deploys get a fresh hostname every time, so they cannot be enumerated.
  "https://*.vercel.app/auth/confirm",
  "https://*.vercel.app/auth/callback"
];

/** Everything about sending except the key, which is a secret and comes from the environment. */
export const SMTP = {
  host: "smtp.resend.com",
  port: 587,
  user: "resend",
  adminEmail: "noreply@airrow.app",
  senderName: "Airrow"
};

export const REQUIRED_CREDENTIALS = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"];

/** Raised when the run has no credentials to push with. */
export class MissingCredentialsError extends Error {}

/** Throws naming every variable that is missing, so one run reports the whole gap. */
export function requireCredentials(env) {
  const missing = REQUIRED_CREDENTIALS.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new MissingCredentialsError(
      `Saknar ${missing.join(", ")}. Se docs/guides/INFRASTRUCTURE_SETUP.md § 6.`
    );
  }
}

/**
 * The PATCH body for `/v1/projects/{ref}/config/auth`.
 *
 * SMTP is included **only** when `RESEND_API_KEY` is set. Sending the fields with a blank password
 * would overwrite working production settings with nothing — so a run without the key updates the
 * templates and the allow-list and leaves sending exactly as it was.
 */
export function buildAuthConfig(
  readTemplate,
  env,
  { templates = TEMPLATES, redirectUrls = REDIRECT_URLS, smtp = SMTP } = {}
) {
  const body = {
    site_url: SITE_URL,
    uri_allow_list: redirectUrls.join(",")
  };

  for (const { file, subject, subjectField, contentField } of templates) {
    const html = readTemplate(file);
    if (!html.trim()) throw new Error(`${file} är tom — vägrar skriva över mallen i cloud med inget.`);
    // Supabase substitutes this; a template that lost it would mail a confirmation with no way to
    // confirm, and the email would still look perfectly fine in review.
    if (!html.includes("{{ .ConfirmationURL }}")) {
      throw new Error(`${file} saknar {{ .ConfirmationURL }} — mejlet skulle gå ut utan bekräftelselänk.`);
    }
    body[subjectField] = subject;
    body[contentField] = html;
  }

  if (env.RESEND_API_KEY) {
    body.external_email_enabled = true;
    body.smtp_host = smtp.host;
    body.smtp_port = smtp.port;
    body.smtp_user = smtp.user;
    body.smtp_pass = env.RESEND_API_KEY;
    body.smtp_admin_email = smtp.adminEmail;
    body.smtp_sender_name = smtp.senderName;
  }

  return body;
}

/** The body with the one secret in it replaced, so a dry run can be pasted into a ticket. */
export function redactForPrinting(body) {
  const safe = { ...body };
  if ("smtp_pass" in safe) safe.smtp_pass = "***";
  for (const { contentField } of TEMPLATES) {
    if (contentField in safe) safe[contentField] = `<${safe[contentField].length} tecken HTML>`;
  }
  return safe;
}

function readTemplateFromDisk(file) {
  return readFileSync(new URL(file, TEMPLATES_DIR), "utf8");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  let body;
  try {
    if (!dryRun) requireCredentials(process.env);
    body = buildAuthConfig(readTemplateFromDisk, process.env);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }

  if (!("smtp_pass" in body)) {
    console.log(
      "::warning::RESEND_API_KEY är inte satt — mallar och redirect-URL:er uppdateras, SMTP lämnas orört."
    );
  }

  if (dryRun) {
    console.log(JSON.stringify(redactForPrinting(body), null, 2));
    console.log("--dry-run: inget skickades.");
    process.exit(0);
  }

  const response = await fetch(
    `https://api.supabase.com/v1/projects/${process.env.SUPABASE_PROJECT_ID}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    // The body carries the reason (unknown field, revoked token, wrong project). The tokens are in a
    // header and in `smtp_pass`, neither of which is echoed here.
    console.error(`::error::Kunde inte uppdatera auth-konfigurationen (HTTP ${response.status}).`);
    console.error(await response.text());
    process.exit(1);
  }

  const what = ["mallar", "redirect-URL:er", ...("smtp_pass" in body ? ["SMTP"] : [])];
  console.log(`OK: ${what.join(", ")} pushade till projektet.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
