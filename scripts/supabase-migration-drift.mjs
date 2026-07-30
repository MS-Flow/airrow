// Compares the migrations committed in `supabase/migrations` with the ones the linked Supabase
// project has actually applied, and fails when the repo is ahead of the database (spec 77).
//
// It exists because that failure is invisible without it: a merged migration that was never
// pushed to cloud left CI, the tests and the build all green — the tests run against a local
// Supabase that *did* have it — and broke only when a human opened the feature in a browser
// (2026-07-27, `import_sources.digest_version`).
//
// Two callers. `.github/workflows/ci.yml` runs it read-only on every PR so a missing migration
// blocks the merge, and `.github/workflows/supabase-migrate.yml` runs it after `supabase db push`
// so a green apply job means the schema is in step rather than only that the CLI exited zero.
//
// The script owns the whole credential contract — which variables it needs, linking, and when a
// run legitimately cannot check — so both workflows are one `run:` line with the three secrets
// scoped to that step. Keeping it here rather than in workflow YAML is what makes the awkward
// parts unit-testable in `supabase-migration-drift.test.mjs`; none of it can be exercised in CI
// without pointing at the real database.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const MIGRATIONS_DIR = new URL("../supabase/migrations/", import.meta.url);

/** The variables the Supabase CLI needs to reach the linked project. */
export const REQUIRED_CREDENTIALS = [
  "SUPABASE_ACCESS_TOKEN", // authenticates the CLI against the Management API
  "SUPABASE_PROJECT_ID", // which project to link
  "SUPABASE_DB_PASSWORD" // the direct Postgres connection `migration list` and `db push` open
];

/** Raised when the CLI output cannot be read as a migration table — never treated as "in sync". */
export class MigrationListError extends Error {}

/** Raised when the run has no credentials to check with. */
export class MissingCredentialsError extends Error {}

/**
 * A pull request from a fork never receives repository secrets — GitHub withholds them by design,
 * and this repo is public, so that case is real rather than theoretical. The check cannot run
 * there, so it warns and passes instead of turning a contributor's PR red for something
 * structural. A same-repo run with missing credentials still fails hard: that is a misconfigured
 * repo, and the whole point of this script is that "we could not look" must never read as
 * "nothing is wrong".
 */
export function isForkPullRequest(event) {
  return event?.pull_request?.head?.repo?.fork === true;
}

/** The GitHub event payload, or null outside Actions / when it cannot be read. */
export function readGitHubEvent(path = process.env.GITHUB_EVENT_PATH) {
  if (!path) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    // A malformed payload must not decide anything — fall through to the credential check.
    return null;
  }
}

/** Throws naming every variable that is missing, so one run reports the whole gap. */
export function requireCredentials(env) {
  const missing = REQUIRED_CREDENTIALS.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new MissingCredentialsError(
      `Saknar ${missing.join(", ")} som GitHub Secret. Se docs/guides/INFRASTRUCTURE_SETUP.md § Migrations after the bootstrap.`
    );
  }
}

/**
 * `supabase migration list --linked` prints a three-column table: the version present locally,
 * the version present remotely, and its timestamp. A row with only one side filled is drift.
 *
 *         LOCAL      |     REMOTE     |     TIME (UTC)
 *   -----------------|----------------|---------------------
 *    20260727093000  | 20260727093000 | 2026-07-27 09:30:00
 *    20260727140000  |                | 2026-07-27 14:00:00   <- committed, never applied
 *
 * `rowCount` is returned so the caller can tell "nothing is out of step" apart from "we did not
 * understand a word of this output" — see `describeDrift`.
 */
export function parseMigrationList(stdout) {
  const lines = stdout.split(/\r?\n/);

  // The CLI prefixes progress lines and version notices, so find the table rather than assume
  // it starts at line one. No header at all means the output is not a migration table.
  if (!lines.some((line) => /\bLOCAL\b/.test(line) && /\bREMOTE\b/.test(line))) {
    throw new MigrationListError(
      `Kunde inte läsa tabellen från \`supabase migration list --linked\`. Utdata:\n${
        stdout.trim() || "(tomt)"
      }`
    );
  }

  const localOnly = [];
  const remoteOnly = [];
  let rowCount = 0;

  for (const line of lines) {
    const match = line.match(/^\s*(\d*)\s*\|\s*(\d*)\s*\|/);
    if (!match) continue;

    const [, local, remote] = match;
    if (!local && !remote) continue; // a padding row with both sides blank carries no information

    rowCount++;
    if (local && !remote) localOnly.push(local);
    else if (remote && !local) remoteOnly.push(remote);
  }

  return { localOnly, remoteOnly, rowCount };
}

/** `20260727093000_import_digest_version.sql` -> `20260727093000`. */
function versionOf(filename) {
  const match = filename.match(/^(\d+)_/);
  return match ? match[1] : null;
}

/** The migration versions committed in the repo, in the order they apply. */
export function localMigrationVersions(dir = MIGRATIONS_DIR) {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .map(versionOf)
    .filter((version) => version !== null)
    .sort();
}

/**
 * Turns a parsed listing into a verdict plus GitHub annotations, matching the style the audit
 * step in `ci.yml` already uses.
 *
 * Only the repo being *ahead* fails. A version the database has but the repo does not is normal
 * — any branch cut before that migration landed sees exactly that — so it warns instead of
 * failing, which would turn every slightly-behind PR red for no reason.
 */
export function describeDrift({ localOnly, remoteOnly, rowCount }, localVersions) {
  const messages = [];

  // A table we parsed into zero rows while the repo holds migrations means the CLI changed its
  // output format and our regex quietly stopped matching. Fail — the whole point of this script
  // is that "we saw nothing" must never read as "nothing is wrong".
  if (rowCount === 0 && localVersions.length > 0) {
    messages.push({
      level: "error",
      text: `Hittade 0 rader i migrationstabellen men ${localVersions.length} migration(er) i supabase/migrations. Utdataformatet från Supabase CLI har troligen ändrats — uppdatera parsern i scripts/supabase-migration-drift.mjs.`
    });
    return { ok: false, messages };
  }

  for (const version of remoteOnly) {
    messages.push({
      level: "warning",
      text: `Migration ${version} är applicerad på databasen men finns inte i supabase/migrations. Väntat på en gren som är äldre än migrationen; annars är schemat ändrat utanför migrationerna (konstitutionen §II).`
    });
  }

  if (localOnly.length > 0) {
    for (const version of localOnly) {
      messages.push({
        level: "error",
        text: `Migration ${version} finns i supabase/migrations men är inte applicerad på den länkade databasen.`
      });
    }
    messages.push({
      level: "error",
      text: `${localOnly.length} oapplicerad(e) migration(er). Koden går annars ut mot ett schema som saknar det den räknar med — se specs/77-auto-apply-migrations.md.`
    });
    return { ok: false, messages };
  }

  messages.push({
    level: "log",
    text: `OK: schemat är i takt med koden (${localVersions.length} migration(er) applicerade).`
  });
  return { ok: true, messages };
}

function report({ level, text }) {
  console.log(level === "log" ? text : `::${level}::${text}`);
}

/** Runs a Supabase CLI command, turning any failure into a readable reason. */
function supabase(args) {
  try {
    return execFileSync("supabase", args, {
      encoding: "utf8",
      // stderr straight to ours: when the project is paused or a credential is wrong, the CLI's
      // own wording is the readable error. It never echoes the secrets, which arrive through the
      // environment rather than the command line.
      stdio: ["ignore", "pipe", "inherit"]
    });
  } catch (error) {
    const reason =
      error?.code === "ENOENT"
        ? "kommandot `supabase` finns inte på PATH — saknas steget som installerar CLI:n?"
        : `avslutade med exit ${error?.status ?? "okänd"} — pausat Supabase-projekt, felaktig credential, eller nätverksfel`;
    throw new Error(`\`supabase ${args.join(" ")}\` misslyckades: ${reason}`);
  }
}

function main() {
  if (isForkPullRequest(readGitHubEvent())) {
    report({
      level: "warning",
      text: "Hoppar över migrationskontrollen: en PR från en fork får inga repository secrets, så den kan inte läsa databasens schema. Kontrollen körs igen på push till develop/main."
    });
    process.exit(0);
  }

  try {
    requireCredentials(process.env);
    supabase(["link", "--project-ref", process.env.SUPABASE_PROJECT_ID]);

    const verdict = describeDrift(
      parseMigrationList(supabase(["migration", "list", "--linked"])),
      localMigrationVersions()
    );
    verdict.messages.forEach(report);
    process.exit(verdict.ok ? 0 : 1);
  } catch (error) {
    // Every failure above is raised with a message written to be read in a CI log: a missing
    // credential names the variable, a CLI failure names the likely cause, unreadable output
    // quotes itself.
    report({ level: "error", text: error.message });
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
