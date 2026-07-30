// Pushes the auth email templates committed in `supabase/templates/` to the linked Supabase project
// (spec 113), so the repo is the source of truth and the dashboard copy is derived from it.
//
// This exists instead of a line in a runbook telling someone to paste HTML into a form. Spec 77 was
// written because exactly that arrangement — one fact in two places, kept in step by memory — had
// already shipped a broken production database. A template is less dangerous than a schema, but the
// failure is the same shape: the version reviewers read stops being the version founders receive.
//
// `supabase/config.toml` governs the *local* stack; the Management API governs the hosted one. Both
// read this same file.
//
// Usage:  SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_ID=… node scripts/sync-auth-email-templates.mjs
//         (add --dry-run to print what would be sent and exit)

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TEMPLATES_DIR = new URL("../supabase/templates/", import.meta.url);

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

export const REQUIRED_CREDENTIALS = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_PROJECT_ID"];

/** Raised when the run has no credentials to push with. */
export class MissingCredentialsError extends Error {}

/** Throws naming every variable that is missing, so one run reports the whole gap. */
export function requireCredentials(env) {
  const missing = REQUIRED_CREDENTIALS.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new MissingCredentialsError(
      `Saknar ${missing.join(", ")}. Se docs/guides/INFRASTRUCTURE_SETUP.md § Auth-mejl.`
    );
  }
}

/**
 * The PATCH body for `/v1/projects/{ref}/config/auth`, built from the templates on disk.
 *
 * Separated from the request so the assembly is testable without a project to push at — the one part
 * of this script that can be wrong in a way nobody notices.
 */
export function buildAuthConfig(readTemplate, templates = TEMPLATES) {
  const body = {};
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
  return body;
}

function readTemplateFromDisk(file) {
  return readFileSync(new URL(file, TEMPLATES_DIR), "utf8");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  let body;
  try {
    if (!dryRun) requireCredentials(process.env);
    body = buildAuthConfig(readTemplateFromDisk);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }

  if (dryRun) {
    for (const [field, value] of Object.entries(body)) {
      console.log(`${field}: ${value.length} tecken`);
    }
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
    // The body carries the reason (unknown field, revoked token, wrong project); the token is in a
    // header and never echoed.
    console.error(`::error::Kunde inte uppdatera auth-konfigurationen (HTTP ${response.status}).`);
    console.error(await response.text());
    process.exit(1);
  }

  console.log(`OK: ${TEMPLATES.length} mejlmall(ar) pushade till projektet.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
