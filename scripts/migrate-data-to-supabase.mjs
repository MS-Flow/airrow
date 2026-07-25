// One-off importer: local .data/ file store (issue #9 era) → Supabase (issue #14).
//
// Idempotent: every write is an upsert on the natural key, so re-running is safe.
// Rows whose parent is missing (orphaned reference) are skipped with a warning rather
// than aborting the run. Users + sessions are moved to .data/bridge.json (the dev-auth
// bridge the cutover still reads); all org-scoped data goes to Supabase.
//
// Run:  pnpm migrate:data      (needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY;
//                               read from the environment or repo-root .env.local)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_DIR = process.env.AIRROW_DATA_DIR ?? path.join(ROOT, ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const ARTIFACTS_DIR = path.join(DATA_DIR, "artifacts");
const BRIDGE_PATH = path.join(DATA_DIR, "bridge.json");

/** Load repo-root .env.local into process.env for keys not already set (node won't do it). */
function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (env or .env.local).");
  }
  if (!fs.existsSync(DB_PATH)) {
    console.log(`No ${DB_PATH} — nothing to migrate.`);
    return;
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const db = readJson(DB_PATH, {});
  let migrated = 0;
  let skipped = 0;

  // Upsert a batch in dependency order; per-row so one orphan doesn't sink the rest.
  async function upsertEach(table, records, toRow, onConflict) {
    for (const rec of records ?? []) {
      const { error } = await supabase.from(table).upsert(toRow(rec), { onConflict });
      if (error) {
        console.warn(`  skip ${table} ${rec.id ?? ""}: ${error.message}`);
        skipped++;
      } else {
        migrated++;
      }
    }
  }

  console.log("Migrating org-scoped data to Supabase…");
  await upsertEach("organizations", db.organizations,
    (o) => ({ id: o.id, name: o.name, kind: o.kind ?? "personal", created_by: o.createdBy ?? null }), "id");
  await upsertEach("organization_members", db.members,
    (m) => ({ organization_id: m.organizationId, user_id: m.userId, role: m.role ?? "member" }),
    "organization_id,user_id");
  await upsertEach("projects", db.projects,
    (p) => ({ id: p.id, organization_id: p.organizationId, name: p.name, slug: p.slug,
      description: p.description ?? "", status: p.status, created_at: p.createdAt, updated_at: p.updatedAt }), "id");
  await upsertEach("interviews", db.interviews,
    (i) => ({ id: i.id, project_id: i.projectId, schema_version: i.schemaVersion,
      answers: i.answers ?? {}, completed_at: i.completedAt ?? null }), "id");
  await upsertEach("project_models", db.modelVersions,
    (v) => ({ id: v.id, project_id: v.projectId, version: v.version, model: v.model, created_at: v.createdAt }), "id");
  await upsertEach("generation_jobs", db.jobs,
    (j) => ({ id: j.id, project_id: j.projectId, model_version_id: j.modelVersionId, status: j.status,
      stage: j.stage ?? null, stages_done: j.stagesDone ?? [], files_authored: j.filesAuthored ?? 0,
      total_files: j.totalFiles ?? 0, current_path: j.currentPath ?? null, error: j.error ?? null,
      heartbeat_at: j.heartbeatAt, started_at: j.startedAt ?? null, finished_at: j.finishedAt ?? null }), "id");
  await upsertEach("deliveries", db.deliveries,
    (d) => ({ id: d.id, project_id: d.projectId, job_id: d.jobId, method: d.method,
      status: d.status ?? "completed", created_at: d.createdAt }), "id");

  // Artifacts: one JSON blob per job under .data/artifacts/<jobId>.json.
  if (fs.existsSync(ARTIFACTS_DIR)) {
    for (const file of fs.readdirSync(ARTIFACTS_DIR)) {
      if (!file.endsWith(".json")) continue;
      const jobId = file.replace(/\.json$/, "");
      const result = readJson(path.join(ARTIFACTS_DIR, file), null);
      if (!result) continue;
      const { error } = await supabase.from("artifacts")
        .upsert({ generation_job_id: jobId, result }, { onConflict: "generation_job_id" });
      if (error) { console.warn(`  skip artifact ${jobId}: ${error.message}`); skipped++; } else { migrated++; }
    }
  }

  // Users + sessions stay local — move them into the dev-auth bridge file.
  const bridge = readJson(BRIDGE_PATH, { users: [], sessions: [] });
  const byId = (arr, x) => arr.some((e) => e.id === x.id);
  const byToken = (arr, x) => arr.some((e) => e.token === x.token);
  for (const u of db.users ?? []) if (!byId(bridge.users, u)) bridge.users.push(u);
  for (const s of db.sessions ?? []) if (!byToken(bridge.sessions, s)) bridge.sessions.push(s);
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BRIDGE_PATH, JSON.stringify(bridge, null, 2), "utf8");

  console.log(`Done. ${migrated} rows upserted, ${skipped} skipped. ` +
    `Users/sessions written to ${path.relative(ROOT, BRIDGE_PATH)}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
