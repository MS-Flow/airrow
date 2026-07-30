import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  MissingCredentialsError,
  REDIRECT_URLS,
  REQUIRED_CREDENTIALS,
  SITE_URL,
  SMTP,
  TEMPLATES,
  buildAuthConfig,
  redactForPrinting,
  requireCredentials
} from "./sync-supabase-auth.mjs";

const ALL_CREDENTIALS = Object.fromEntries(REQUIRED_CREDENTIALS.map((name) => [name, "x"]));

const VALID_HTML = '<a href="{{ .ConfirmationURL }}">Confirm email address</a>';
const reader = (contents) => () => contents;

describe("buildAuthConfig", () => {
  it("sets the canonical site URL, which is the fallback when a request passes no redirect", () => {
    expect(buildAuthConfig(reader(VALID_HTML), {}).site_url).toBe(SITE_URL);
  });

  it("sends the redirect allow-list as one comma-separated field", () => {
    expect(buildAuthConfig(reader(VALID_HTML), {}).uri_allow_list).toBe(REDIRECT_URLS.join(","));
  });

  it("maps each template onto the auth-config fields the API expects", () => {
    const body = buildAuthConfig(reader(VALID_HTML), {});

    expect(body.mailer_subjects_confirmation).toBe("Confirm your email address");
    expect(body.mailer_templates_confirmation_content).toBe(VALID_HTML);
  });

  it("reads the template by filename, so the file on disk is what gets pushed", () => {
    const asked = [];
    buildAuthConfig((file) => {
      asked.push(file);
      return VALID_HTML;
    }, {});

    expect(asked).toEqual(["confirmation.html"]);
  });

  // The two ways a template can be broken while still looking fine in a diff.
  it("refuses to overwrite the cloud template with an empty file", () => {
    expect(() => buildAuthConfig(reader("   \n  "), {})).toThrow(/är tom/);
  });

  it("refuses a template that lost the confirmation URL placeholder", () => {
    expect(() => buildAuthConfig(reader("<p>Welcome to Airrow</p>"), {})).toThrow(/ConfirmationURL/);
  });

  it("includes the SMTP settings when the Resend key is present", () => {
    const body = buildAuthConfig(reader(VALID_HTML), { RESEND_API_KEY: "re_123" });

    expect(body).toMatchObject({
      external_email_enabled: true,
      smtp_host: SMTP.host,
      smtp_port: SMTP.port,
      smtp_user: SMTP.user,
      smtp_pass: "re_123",
      smtp_admin_email: SMTP.adminEmail,
      smtp_sender_name: SMTP.senderName
    });
  });

  // Blanking working production SMTP is worse than not touching it, so a run without the key has to
  // leave sending alone rather than send empty strings.
  it("omits SMTP entirely without the key, rather than blanking what is configured", () => {
    const body = buildAuthConfig(reader(VALID_HTML), {});

    expect(body).not.toHaveProperty("smtp_pass");
    expect(body).not.toHaveProperty("smtp_host");
    expect(body).not.toHaveProperty("external_email_enabled");
    // The rest still goes.
    expect(body).toHaveProperty("mailer_templates_confirmation_content");
  });

  it("treats an empty key the same as an absent one", () => {
    expect(buildAuthConfig(reader(VALID_HTML), { RESEND_API_KEY: "" })).not.toHaveProperty("smtp_pass");
  });
});

describe("redactForPrinting", () => {
  it("hides the SMTP password so a dry run can be pasted anywhere", () => {
    const body = buildAuthConfig(reader(VALID_HTML), { RESEND_API_KEY: "re_secret" });
    const printed = JSON.stringify(redactForPrinting(body));

    expect(printed).not.toContain("re_secret");
    expect(printed).toContain("***");
  });

  it("summarises the template instead of dumping it", () => {
    const printed = redactForPrinting(buildAuthConfig(reader(VALID_HTML), {}));

    expect(printed.mailer_templates_confirmation_content).toMatch(/^<\d+ tecken HTML>$/);
  });

  it("leaves the original body untouched", () => {
    const body = buildAuthConfig(reader(VALID_HTML), { RESEND_API_KEY: "re_secret" });
    redactForPrinting(body);

    expect(body.smtp_pass).toBe("re_secret");
  });
});

describe("requireCredentials", () => {
  it("accepts a run that has both", () => {
    expect(() => requireCredentials(ALL_CREDENTIALS)).not.toThrow();
  });

  it("names every missing variable in one go, not just the first", () => {
    expect(() => requireCredentials({})).toThrow(/SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_ID/);
  });

  it("treats an empty value as missing — an unset secret arrives as an empty string", () => {
    expect(() => requireCredentials({ ...ALL_CREDENTIALS, SUPABASE_PROJECT_ID: "" })).toThrow(
      MissingCredentialsError
    );
  });

  it("points at the runbook so the reader knows where to fix it", () => {
    expect(() => requireCredentials({})).toThrow(/INFRASTRUCTURE_SETUP\.md/);
  });
});

describe("the template committed in the repo", () => {
  it("passes its own validation", () => {
    expect(() =>
      buildAuthConfig((file) => readFileSync(`supabase/templates/${file}`, "utf8"), {})
    ).not.toThrow();
  });
});

// The app decides at request time which hosts it will build a redirect for; this script tells Supabase
// which ones to accept. A host in one and not the other is a confirmation link that gets built and then
// rejected — invisible until someone signs up on that environment. This is the tripwire.
describe("the allow-list agrees with the app's", () => {
  const appSource = readFileSync("apps/web/src/lib/site-url.ts", "utf8");

  /** The hosts named in `ALLOWED_HOSTS` in site-url.ts. */
  const appHosts = () => {
    const block = appSource.match(/ALLOWED_HOSTS\s*=\s*\[([^\]]*)\]/);
    if (!block) throw new Error("Hittade inte ALLOWED_HOSTS i site-url.ts — har den bytt form?");
    return [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  };

  it("finds the app's host list, so this check cannot pass by failing to look", () => {
    expect(appHosts().length).toBeGreaterThan(0);
  });

  it("names every host the app is willing to redirect to", () => {
    const listed = new Set(REDIRECT_URLS.map((url) => new URL(url.replace("*.", "wildcard.")).host));

    for (const host of appHosts()) {
      // `www.airrow.app` redirects to the apex before any auth flow runs, so it needs no entry.
      if (host === "www.airrow.app") continue;
      expect(listed, `${host} saknas i REDIRECT_URLS`).toContain(host);
    }
  });

  it("covers both auth landings for each host it names", () => {
    const confirm = REDIRECT_URLS.filter((u) => u.endsWith("/auth/confirm"));
    const callback = REDIRECT_URLS.filter((u) => u.endsWith("/auth/callback"));

    expect(confirm.map((u) => new URL(u.replace("*.", "wildcard.")).host).sort()).toEqual(
      callback.map((u) => new URL(u.replace("*.", "wildcard.")).host).sort()
    );
  });
});
