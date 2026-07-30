import { describe, expect, it } from "vitest";

import {
  MissingCredentialsError,
  REQUIRED_CREDENTIALS,
  TEMPLATES,
  buildAuthConfig,
  requireCredentials
} from "./sync-auth-email-templates.mjs";

const ALL_CREDENTIALS = Object.fromEntries(REQUIRED_CREDENTIALS.map((name) => [name, "x"]));

const VALID_HTML = '<a href="{{ .ConfirmationURL }}">Confirm email address</a>';
const reader = (contents) => () => contents;

describe("buildAuthConfig", () => {
  it("maps each template onto the auth-config fields the API expects", () => {
    expect(buildAuthConfig(reader(VALID_HTML))).toEqual({
      mailer_subjects_confirmation: "Confirm your email address",
      mailer_templates_confirmation_content: VALID_HTML
    });
  });

  it("reads the template by filename, so the file on disk is what gets pushed", () => {
    const asked = [];
    buildAuthConfig((file) => {
      asked.push(file);
      return VALID_HTML;
    });

    expect(asked).toEqual(["confirmation.html"]);
  });

  // The two ways a template can be broken while still looking fine in a diff.
  it("refuses to overwrite the cloud template with an empty file", () => {
    expect(() => buildAuthConfig(reader("   \n  "))).toThrow(/är tom/);
  });

  it("refuses a template that lost the confirmation URL placeholder", () => {
    expect(() => buildAuthConfig(reader("<p>Welcome to Airrow</p>"))).toThrow(/ConfirmationURL/);
  });

  it("handles more templates than the one we ship today", () => {
    const body = buildAuthConfig(reader(VALID_HTML), [
      ...TEMPLATES,
      {
        file: "recovery.html",
        subject: "Reset your password",
        subjectField: "mailer_subjects_recovery",
        contentField: "mailer_templates_recovery_content"
      }
    ]);

    expect(body.mailer_subjects_recovery).toBe("Reset your password");
    expect(body.mailer_templates_recovery_content).toBe(VALID_HTML);
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
  it("passes its own validation", async () => {
    const { readFileSync } = await import("node:fs");

    expect(() =>
      buildAuthConfig((file) => readFileSync(`supabase/templates/${file}`, "utf8"))
    ).not.toThrow();
  });
});
