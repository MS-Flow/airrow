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

    for (const { subject, subjectField, contentField } of TEMPLATES) {
      expect(body[subjectField]).toBe(subject);
      expect(body[contentField]).toBe(VALID_HTML);
    }
  });

  it("reads every template by filename, so the files on disk are what get pushed", () => {
    const asked = [];
    buildAuthConfig((file) => {
      asked.push(file);
      return VALID_HTML;
    }, {});

    expect(asked).toEqual(TEMPLATES.map((t) => t.file));
  });

  // Reset and email change were spec 113's "adding one is a row plus its HTML file"; spec 171 added them,
  // and this is what stops one going missing again.
  it("manages the signup, reset and email-change mails", () => {
    expect(TEMPLATES.map((t) => t.file)).toEqual([
      "confirmation.html",
      "recovery.html",
      "email-change.html"
    ]);
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
      smtp_user: SMTP.user,
      smtp_pass: "re_123",
      smtp_admin_email: SMTP.adminEmail,
      smtp_sender_name: SMTP.senderName
    });
  });

  // The API rejects a number here — "expected string, received number" — so the conversion is part of
  // the contract, not a formatting preference.
  it("sends the port as a string, which is what the API accepts", () => {
    const body = buildAuthConfig(reader(VALID_HTML), { RESEND_API_KEY: "re_123" });

    expect(body.smtp_port).toBe("587");
    expect(typeof body.smtp_port).toBe("string");
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

  // A value with whitespace is set, so every "is it there?" check passes — and the API answers with a
  // 401 about header format that says nothing about the cause. This is the shape a pasted multi-line
  // block leaves behind when Read-Host swallows the next line.
  it("rejects a token that swallowed a whole command", () => {
    expect(() =>
      requireCredentials({
        ...ALL_CREDENTIALS,
        SUPABASE_ACCESS_TOKEN: '$env:RESEND_API_KEY = Read-Host "Resend API key"'
      })
    ).toThrow(/blanksteg/);
  });

  it("rejects a trailing newline, which a paste leaves behind invisibly", () => {
    expect(() => requireCredentials({ ...ALL_CREDENTIALS, SUPABASE_PROJECT_ID: "abc\n" })).toThrow(
      MissingCredentialsError
    );
  });

  it("explains how the whitespace got there, not just that it is there", () => {
    expect(() => requireCredentials({ ...ALL_CREDENTIALS, SUPABASE_ACCESS_TOKEN: "a b" })).toThrow(
      /Read-Host/
    );
  });

  it("accepts an ordinary token", () => {
    expect(() =>
      requireCredentials({ ...ALL_CREDENTIALS, SUPABASE_ACCESS_TOKEN: "sbp_0102abcdef" })
    ).not.toThrow();
  });
});

describe("the templates committed in the repo", () => {
  // Comments explain the markup and mention tags in prose; only what actually renders is checked.
  const rendered = (file) =>
    readFileSync(`supabase/templates/${file}`, "utf8").replace(/<!--[\s\S]*?-->/g, "");
  const html = TEMPLATES.map((t) => rendered(t.file)).join("\n");

  it("pass their own validation", () => {
    expect(() =>
      buildAuthConfig((file) => readFileSync(`supabase/templates/${file}`, "utf8"), {})
    ).not.toThrow();
  });

  // An email cannot resolve a relative path, and a renamed asset would degrade to alt text forever
  // without anything failing — so the file it points at has to exist, and be the small one.
  it("reference images by absolute URL only", () => {
    for (const [, src] of html.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)) {
      expect(src).toMatch(/^https:\/\//);
    }
  });

  it("point at brand assets that are actually in the repo", () => {
    for (const [, src] of html.matchAll(/<img[^>]*\ssrc="https:\/\/airrow\.app(\/[^"]*)"/g)) {
      expect(() => readFileSync(`apps/web/public${src}`)).not.toThrow();
    }
  });

  it("keeps the logo small enough for an inbox", () => {
    const bytes = readFileSync("apps/web/public/brand/airrow-mark-email.png").length;

    expect(bytes).toBeLessThan(50_000);
  });

  /*
   * One mark across all three, which is what made this worth asserting.
   *
   * The mark-alone decision landed on `feature/infrastructure` two minutes after PR #119 squashed that
   * branch into develop, so it never travelled — and the reset and email-change templates were then
   * written against the lockup that was still there. Two mails branded one way and one the other is the
   * kind of thing nobody notices until a founder has seen both.
   */
  it("uses the same logo in every mail", () => {
    const sources = TEMPLATES.flatMap((t) => [
      ...rendered(t.file).matchAll(/<img[^>]*\ssrc="([^"]*)"/g)
    ]).map(([, src]) => src);

    expect(sources).toHaveLength(TEMPLATES.length);
    expect(new Set(sources).size).toBe(1);
  });

  it("gives every image alt text, since clients block images by default", () => {
    for (const [tag] of html.matchAll(/<img[^>]*>/g)) {
      expect(tag).toMatch(/\salt="[^"]+"/);
    }
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

  // Three landings now (spec 171): a reset link built for a host Supabase has not been told about is
  // rejected at the moment a locked-out founder clicks it, which is the worst possible time to find out.
  it("covers every auth landing for each host it names", () => {
    const hostsFor = (path) =>
      REDIRECT_URLS.filter((u) => u.endsWith(path))
        .map((u) => new URL(u.replace("*.", "wildcard.")).host)
        .sort();

    expect(hostsFor("/auth/callback")).toEqual(hostsFor("/auth/confirm"));
    expect(hostsFor("/auth/reset")).toEqual(hostsFor("/auth/confirm"));
  });
});
