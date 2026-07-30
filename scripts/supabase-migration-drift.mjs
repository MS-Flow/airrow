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
 * The CLI's own machine-readable shape, which `--output-format json` asks for:
 *
 *   {"migrations":[{"local":"20260726120000","remote":"","time":"…"}, …],"message":"…"}
 *
 * Preferred over the table because it is not formatting. The object arrives after a couple of
 * progress lines, so the JSON is looked for line by line rather than parsed from the whole output.
 * Returns null when this output is not JSON, which is the signal to fall back to the table.
 */
export function parseMigrationJson(stdout) {
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const parsed = JSON.parse(line);
      if (!Array.isArray(parsed?.migrations)) continue;

      const localOnly = [];
      const remoteOnly = [];
      for (const { local, remote } of parsed.migrations) {
        if (local && !remote) localOnly.push(local);
        else if (remote && !local) remoteOnly.push(remote);
      }
      return { localOnly, remoteOnly, rowCount: parsed.migrations.length };
    } catch {
      continue; // a line that merely starts with `{` and is not the payload
    }
  }
  return null;
}

/**
 * `supabase migration list --linked` prints a three-column table: the version present locally,
 * the version present remotely, and its timestamp. A row with only one side filled is drift.
 *
 *   Local            | Remote           | Time (UTC)
 *   -----------------|------------------|-----------------------
 *    `20260727093000` | `20260727093000` | `2026-07-27 09:30:00`
 *    `20260727140000` | ` `              | `2026-07-27 14:00:00`   <- committed, never applied
 *
 * The cells arrive wrapped in backticks and an "absent" side is a backticked space, not an empty
 * cell — so cells are stripped and validated as digits rather than matched in place. Both are
 * things the real CLI does that a plausible-looking fixture does not; the version and the casing
 * of the header have already changed once, which is why nothing here assumes either.
 *
 * `rowCount` is returned so the caller can tell "nothing is out of step" apart from "we did not
 * understand a word of this output" — see `describeDrift`.
 */
export function parseMigrationList(stdout) {
  // JSON first: what the CLI emits when asked, and what it emits by itself in some versions.
  // The table is the fallback, because both shapes turned up from real runs of "latest" — the
  // GitHub Action installed a build that printed the table while `pnpm dlx supabase` printed JSON.
  const asJson = parseMigrationJson(stdout);
  if (asJson) return asJson;

  const lines = stdout.split(/\r?\n/);

  // The CLI prefixes progress lines and version notices, so find the table rather than assume it
  // starts at line one. Case-insensitive: the header reads `Local | Remote`, not `LOCAL | REMOTE`.
  // No header at all means the output is not a migration table.
  if (!lines.some((line) => /\blocal\b/i.test(line) && /\bremote\b/i.test(line))) {
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
    const cells = line.split("|");
    if (cells.length < 2) continue;

    const [local, remote] = cells.map((cell) => cell.replaceAll("`", "").trim());
    // Skips the header and the dashed rule as well as anything else that is not a version pair.
    if (!/^\d*$/.test(local) || !/^\d*$/.test(remote)) continue;
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

/** `supabase/migrations/20260726120000_import.sql` -> `20260726120000`, from `git diff` output. */
export function parseAddedMigrations(gitDiffOutput) {
  return gitDiffOutput
    .split(/\r?\n/)
    .map((line) => line.trim().match(/(\d{14})_[^/]*\.sql$/))
    .filter((match) => match !== null)
    .map((match) => match[1]);
}

/**
 * Turns a parsed listing into a verdict plus GitHub annotations, matching the style the audit
 * step in `ci.yml` already uses.
 *
 * Three states, not two:
 *
 * - **The repo is ahead because of this pull request** — the migration is committed here and will
 *   be applied when it merges. Reported, never a failure: failing would make every PR that adds a
 *   migration permanently red, since the only thing that can apply it is the merge the check is
 *   blocking.
 * - **The repo is ahead for reasons that predate this pull request** — something merged and never
 *   reached the database. That is the 2026-07-27 incident, and it fails: stacking more schema on
 *   top of a broken apply pipeline is how one missed migration becomes several.
 * - **The database is ahead** — normal on any branch cut before that migration landed, so it
 *   warns rather than failing, which would redden every slightly-behind PR for no reason.
 */
export function describeDrift({ localOnly, remoteOnly, rowCount }, localVersions, addedHere = []) {
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

  const addedInThisChange = new Set(addedHere);
  const pending = localOnly.filter((version) => addedInThisChange.has(version));
  const blocking = localOnly.filter((version) => !addedInThisChange.has(version));

  for (const version of pending) {
    messages.push({
      level: "log",
      text: `Migration ${version} läggs till av den här ändringen och appliceras när den merge:as.`
    });
  }

  if (blocking.length > 0) {
    for (const version of blocking) {
      messages.push({
        level: "error",
        text: `Migration ${version} finns i supabase/migrations men är inte applicerad på den länkade databasen, och läggs inte till av den här ändringen.`
      });
    }
    messages.push({
      level: "error",
      text: `${blocking.length} oapplicerad(e) migration(er) som redan var merge:ad(e). Koden går ut mot ett schema som saknar det den räknar med — kör om apply-jobbet (.github/workflows/supabase-migrate.yml) innan mer schema staplas ovanpå. Se specs/77-auto-apply-migrations.md.`
    });
    return { ok: false, messages };
  }

  messages.push({
    level: "log",
    text: `OK: schemat är i takt med koden (${localVersions.length} migration(er), ${pending.length} tillkommer i den här ändringen).`
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

/**
 * The migrations this pull request adds on top of its base branch. Empty outside a PR, and empty
 * when the base cannot be resolved — failing closed on purpose: blocking on drift we cannot
 * explain is the safe direction, waving it through is not.
 */
function migrationsAddedInPullRequest() {
  const base = process.env.GITHUB_BASE_REF;
  if (!base) return [];

  try {
    return parseAddedMigrations(
      execFileSync(
        "git",
        [
          "diff",
          "--name-only",
          "--diff-filter=A",
          `origin/${base}...HEAD`,
          "--",
          "supabase/migrations"
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }
      )
    );
  } catch {
    console.log(
      `::warning::Kunde inte jämföra mot origin/${base}, så alla oapplicerade migrationer räknas som redan merge:ade. Hämtades basgrenen i workflowet?`
    );
    return [];
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

    const list = ["migration", "list", "--linked"];
    // Ask for JSON, but do not depend on the flag existing: `--output-format` is not in every
    // release, and the version is deliberately unpinned. An older CLI rejects it and gets the
    // table instead, which `parseMigrationList` also reads.
    let stdout;
    try {
      stdout = supabase([...list, "--output-format", "json"]);
    } catch {
      stdout = supabase(list);
    }

    const verdict = describeDrift(
      parseMigrationList(stdout),
      localMigrationVersions(),
      migrationsAddedInPullRequest()
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
