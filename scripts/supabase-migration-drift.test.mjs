import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MigrationListError,
  MissingCredentialsError,
  REQUIRED_CREDENTIALS,
  describeDrift,
  isForkPullRequest,
  localMigrationVersions,
  parseMigrationList,
  readGitHubEvent,
  requireCredentials
} from "./supabase-migration-drift.mjs";

const ALL_CREDENTIALS = Object.fromEntries(REQUIRED_CREDENTIALS.map((name) => [name, "x"]));

const IN_SYNC = `Connecting to remote database...

        LOCAL      |     REMOTE     |     TIME (UTC)
  -----------------|----------------|---------------------
   20260724132100  | 20260724132100 | 2026-07-24 13:21:00
   20260725100000  | 20260725100000 | 2026-07-25 10:00:00
`;

// The 2026-07-27 failure, exactly as the CLI would have shown it: the migration was committed
// and merged, but the cloud project never got it.
const DIGEST_VERSION_NEVER_PUSHED = `        LOCAL      |     REMOTE     |     TIME (UTC)
  -----------------|----------------|---------------------
   20260726120000  | 20260726120000 | 2026-07-26 12:00:00
   20260727093000  |                | 2026-07-27 09:30:00
`;

const SEVERAL_UNAPPLIED = `        LOCAL      |     REMOTE     |     TIME (UTC)
  -----------------|----------------|---------------------
   20260726120000  | 20260726120000 | 2026-07-26 12:00:00
   20260727140000  |                | 2026-07-27 14:00:00
   20260727160000  |                | 2026-07-27 16:00:00
`;

// A branch cut before a migration landed on develop sees the database ahead of itself.
const DATABASE_AHEAD = `        LOCAL      |     REMOTE     |     TIME (UTC)
  -----------------|----------------|---------------------
   20260726120000  | 20260726120000 | 2026-07-26 12:00:00
                   | 20260727093000 | 2026-07-27 09:30:00
`;

const errorsOf = (verdict) => verdict.messages.filter((m) => m.level === "error").map((m) => m.text);
const warningsOf = (verdict) => verdict.messages.filter((m) => m.level === "warning").map((m) => m.text);

describe("parseMigrationList", () => {
  it("reports no drift when every local migration is applied remotely", () => {
    expect(parseMigrationList(IN_SYNC)).toEqual({ localOnly: [], remoteOnly: [], rowCount: 2 });
  });

  it("finds a migration that is committed but never applied", () => {
    expect(parseMigrationList(DIGEST_VERSION_NEVER_PUSHED).localOnly).toEqual(["20260727093000"]);
  });

  it("finds every unapplied migration when several are outstanding", () => {
    expect(parseMigrationList(SEVERAL_UNAPPLIED).localOnly).toEqual([
      "20260727140000",
      "20260727160000"
    ]);
  });

  it("separates a database that is ahead from one that is behind", () => {
    const { localOnly, remoteOnly } = parseMigrationList(DATABASE_AHEAD);

    expect(localOnly).toEqual([]);
    expect(remoteOnly).toEqual(["20260727093000"]);
  });

  it("ignores the CLI's progress lines and the table rules", () => {
    expect(parseMigrationList(IN_SYNC).rowCount).toBe(2);
  });

  it("counts a table with a header and no migrations as readable but empty", () => {
    const parsed = parseMigrationList("   LOCAL | REMOTE | TIME (UTC)\n  -------|--------|------\n");

    expect(parsed).toEqual({ localOnly: [], remoteOnly: [], rowCount: 0 });
  });

  it("refuses output that is not a migration table", () => {
    expect(() => parseMigrationList("Cannot find project ref. Have you run supabase link?")).toThrow(
      MigrationListError
    );
  });

  it("refuses empty output rather than reading it as in sync", () => {
    expect(() => parseMigrationList("")).toThrow(MigrationListError);
  });
});

describe("describeDrift", () => {
  it("passes when the schema is in step with the code", () => {
    const verdict = describeDrift(parseMigrationList(IN_SYNC), ["20260724132100", "20260725100000"]);

    expect(verdict.ok).toBe(true);
    expect(errorsOf(verdict)).toEqual([]);
  });

  it("fails on the migration that was merged but never pushed to cloud", () => {
    const verdict = describeDrift(parseMigrationList(DIGEST_VERSION_NEVER_PUSHED), [
      "20260726120000",
      "20260727093000"
    ]);

    expect(verdict.ok).toBe(false);
    expect(errorsOf(verdict).join("\n")).toContain("20260727093000");
  });

  it("names every unapplied migration, not just the first", () => {
    const verdict = describeDrift(parseMigrationList(SEVERAL_UNAPPLIED), []);
    const errors = errorsOf(verdict).join("\n");

    expect(errors).toContain("20260727140000");
    expect(errors).toContain("20260727160000");
    expect(errors).toContain("2 oapplicerad");
  });

  it("warns but stays green when the database is ahead of the branch", () => {
    const verdict = describeDrift(parseMigrationList(DATABASE_AHEAD), ["20260726120000"]);

    expect(verdict.ok).toBe(true);
    expect(warningsOf(verdict).join("\n")).toContain("20260727093000");
  });

  it("fails when the table parsed to nothing but the repo holds migrations", () => {
    const verdict = describeDrift({ localOnly: [], remoteOnly: [], rowCount: 0 }, ["20260724132100"]);

    expect(verdict.ok).toBe(false);
    expect(errorsOf(verdict).join("\n")).toContain("Utdataformatet");
  });

  it("accepts an empty table when the repo has no migrations either", () => {
    expect(describeDrift({ localOnly: [], remoteOnly: [], rowCount: 0 }, []).ok).toBe(true);
  });
});

describe("requireCredentials", () => {
  it("accepts a run that has all three", () => {
    expect(() => requireCredentials(ALL_CREDENTIALS)).not.toThrow();
  });

  it("names every missing variable in one go, not just the first", () => {
    expect(() => requireCredentials({ SUPABASE_PROJECT_ID: "ref" })).toThrow(
      /SUPABASE_ACCESS_TOKEN, SUPABASE_DB_PASSWORD/
    );
  });

  it("treats an empty value as missing — an unset secret arrives as an empty string", () => {
    expect(() => requireCredentials({ ...ALL_CREDENTIALS, SUPABASE_DB_PASSWORD: "" })).toThrow(
      MissingCredentialsError
    );
  });

  it("points at the runbook so the reader knows where to fix it", () => {
    expect(() => requireCredentials({})).toThrow(/INFRASTRUCTURE_SETUP\.md/);
  });
});

describe("isForkPullRequest", () => {
  it("recognises a pull request opened from a fork", () => {
    expect(isForkPullRequest({ pull_request: { head: { repo: { fork: true } } } })).toBe(true);
  });

  it("does not treat a same-repo pull request as a fork", () => {
    expect(isForkPullRequest({ pull_request: { head: { repo: { fork: false } } } })).toBe(false);
  });

  it("does not treat a push event as a fork — it has no pull_request at all", () => {
    expect(isForkPullRequest({ ref: "refs/heads/develop" })).toBe(false);
  });

  it("does not treat a missing payload as a fork, so credentials still decide", () => {
    expect(isForkPullRequest(null)).toBe(false);
  });
});

describe("readGitHubEvent", () => {
  // Stubbing the variable rather than passing `undefined`: the argument defaults to
  // `process.env.GITHUB_EVENT_PATH`, so `readGitHubEvent(undefined)` reads whatever the
  // surrounding environment has — green locally, and in CI it parsed the real push payload.
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null outside Actions, where GITHUB_EVENT_PATH is not set", () => {
    vi.stubEnv("GITHUB_EVENT_PATH", "");

    expect(readGitHubEvent()).toBeNull();
  });

  it("returns null for an unreadable payload rather than crashing the check", () => {
    expect(readGitHubEvent("./does-not-exist.json")).toBeNull();
  });

  it("parses a payload that is there", () => {
    expect(readGitHubEvent("./package.json")).toMatchObject({ name: "airrow" });
  });
});

describe("localMigrationVersions", () => {
  it("reads the repo's own migrations in apply order", () => {
    const versions = localMigrationVersions();

    expect(versions.length).toBeGreaterThan(0);
    expect(versions).toEqual([...versions].sort());
    expect(versions.every((version) => /^\d{14}$/.test(version))).toBe(true);
  });
});
