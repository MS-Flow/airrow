import { afterEach, describe, expect, it, vi } from "vitest";

import {
  MigrationListError,
  MissingCredentialsError,
  REQUIRED_CREDENTIALS,
  describeDrift,
  isForkPullRequest,
  localMigrationVersions,
  parseAddedMigrations,
  parseMigrationJson,
  parseMigrationList,
  readGitHubEvent,
  requireCredentials
} from "./supabase-migration-drift.mjs";

const ALL_CREDENTIALS = Object.fromEntries(REQUIRED_CREDENTIALS.map((name) => [name, "x"]));

// Captured verbatim from Actions run 30527700456. The CLI backticks every cell, writes an absent
// side as a backticked space, and titles the columns `Local`/`Remote` rather than in caps. The
// first version of this parser was written against a plausible-looking fixture and matched none of
// that, so this is the shape everything else is checked against.
const REAL_CLI_OUTPUT = `Connecting to remote database...
Local            | Remote           | Time (UTC)
  ------------------|------------------|-----------------------
   \`20260724132100\` | \`20260724132100\` | \`2026-07-24 13:21:00\`
   \`20260725100000\` | \`20260725100000\` | \`2026-07-25 10:00:00\`
   \`20260725110000\` | \`20260725110000\` | \`2026-07-25 11:00:00\`
   \`20260726120000\` | \` \`              | \`2026-07-26 12:00:00\`
   \`20260727090000\` | \`20260727090000\` | \`2026-07-27 09:00:00\`
   \`20260727093000\` | \` \`              | \`2026-07-27 09:30:00\`
   \`20260727140000\` | \`20260727140000\` | \`2026-07-27 14:00:00\`
   \`20260727160000\` | \`20260727160000\` | \`2026-07-27 16:00:00\`
   \`20260727180000\` | \`20260727180000\` | \`2026-07-27 18:00:00\`
`;

// An older CLI wrote bare digits and capitalised headers. Kept so the parser is not quietly
// narrowed to exactly one release of a tool we deliberately do not pin.
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

// Captured verbatim from `supabase migration list --linked --output-format json` (CLI 2.110.0).
// The same repo state as REAL_CLI_OUTPUT, in the other shape the CLI really produces.
const REAL_CLI_JSON = `Initialising login role...
Connecting to remote database...
{"migrations":[{"local":"20260724132100","remote":"20260724132100","time":"2026-07-24 13:21:00"},{"local":"20260726120000","remote":"","time":"2026-07-26 12:00:00"},{"local":"20260727093000","remote":"","time":"2026-07-27 09:30:00"}],"message":"Migrations listed"}
`;

describe("parseMigrationList", () => {
  it("prefers the CLI's JSON shape when that is what it printed", () => {
    expect(parseMigrationList(REAL_CLI_JSON)).toEqual({
      localOnly: ["20260726120000", "20260727093000"],
      remoteOnly: [],
      rowCount: 3
    });
  });

  it("falls back to the table when the CLI printed no JSON", () => {
    expect(parseMigrationList(REAL_CLI_OUTPUT).localOnly).toEqual([
      "20260726120000",
      "20260727093000"
    ]);
  });

  it("both real shapes agree about the same repo state", () => {
    expect(parseMigrationJson(REAL_CLI_JSON).localOnly).toEqual(
      parseMigrationList(REAL_CLI_OUTPUT).localOnly
    );
  });

  it("returns null from the JSON reader for output that has none, so the table is tried", () => {
    expect(parseMigrationJson(REAL_CLI_OUTPUT)).toBeNull();
  });

  it("ignores a line that starts with a brace but is not the payload", () => {
    expect(parseMigrationJson('{"message":"no migrations key here"}')).toBeNull();
  });

  it("reads the real CLI output — backticked cells, mixed-case header, backticked-space gaps", () => {
    expect(parseMigrationList(REAL_CLI_OUTPUT)).toEqual({
      localOnly: ["20260726120000", "20260727093000"],
      remoteOnly: [],
      rowCount: 9
    });
  });

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

  it("passes a pull request that adds the only unapplied migration", () => {
    const verdict = describeDrift(parseMigrationList(DIGEST_VERSION_NEVER_PUSHED), [], [
      "20260727093000"
    ]);

    expect(verdict.ok).toBe(true);
    expect(errorsOf(verdict)).toEqual([]);
    expect(verdict.messages.map((m) => m.text).join("\n")).toContain("appliceras när den merge:as");
  });

  it("still fails on drift the pull request did not introduce", () => {
    const verdict = describeDrift(parseMigrationList(SEVERAL_UNAPPLIED), [], ["20260727160000"]);
    const errors = errorsOf(verdict).join("\n");

    // The one it adds is fine; the one that was already merged and never applied is not.
    expect(verdict.ok).toBe(false);
    expect(errors).toContain("20260727140000");
    expect(errors).not.toContain("20260727160000");
    expect(errors).toContain("1 oapplicerad");
  });

  it("treats an unknown base as 'all pre-existing', failing closed", () => {
    expect(describeDrift(parseMigrationList(SEVERAL_UNAPPLIED), [], []).ok).toBe(false);
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

describe("parseAddedMigrations", () => {
  it("reads versions out of git diff output", () => {
    const diff = [
      "supabase/migrations/20260726120000_import.sql",
      "supabase/migrations/20260727093000_import_digest_version.sql"
    ].join("\n");

    expect(parseAddedMigrations(diff)).toEqual(["20260726120000", "20260727093000"]);
  });

  it("ignores anything that is not a timestamped migration", () => {
    const diff = ["supabase/config.toml", "supabase/migrations/README.md", ""].join("\n");

    expect(parseAddedMigrations(diff)).toEqual([]);
  });

  it("returns nothing for empty output — a change that adds no migration", () => {
    expect(parseAddedMigrations("")).toEqual([]);
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
