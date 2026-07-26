// RLS access + denial across the full product schema (issue #14). Mirrors the #9
// organizations test: seed two orgs as the superuser, then read each table as an
// authenticated user and assert they see only their own org's rows.
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Deterministic fixture ids — no randomness (constitution §V). Suffix a/b = org A/B.
const ORG_A = "00000000-0000-0000-0000-0000000000aa";
const ORG_B = "00000000-0000-0000-0000-0000000000bb";
// Distinct user namespace ('d…') so fixtures never collide with the #9 organizations
// test (which uses …00a1/…00b1) when Vitest runs the files in parallel on one DB.
const USER_A = "00000000-0000-0000-0000-0000000000d1";
const USER_B = "00000000-0000-0000-0000-0000000000d2";
const PROJECT_A = "00000000-0000-0000-0000-0000000000a2";
const PROJECT_B = "00000000-0000-0000-0000-0000000000b2";
const INTERVIEW_A = "00000000-0000-0000-0000-0000000000a3";
const INTERVIEW_B = "00000000-0000-0000-0000-0000000000b3";
const MODEL_A = "00000000-0000-0000-0000-0000000000a4";
const MODEL_B = "00000000-0000-0000-0000-0000000000b4";
const JOB_A = "00000000-0000-0000-0000-0000000000a5";
const JOB_B = "00000000-0000-0000-0000-0000000000b5";
const ARTIFACT_A = "00000000-0000-0000-0000-0000000000a6";
const ARTIFACT_B = "00000000-0000-0000-0000-0000000000b6";
const DELIVERY_A = "00000000-0000-0000-0000-0000000000a7";
const DELIVERY_B = "00000000-0000-0000-0000-0000000000b7";
const REPO_A = "00000000-0000-0000-0000-0000000000a8";
const REPO_B = "00000000-0000-0000-0000-0000000000b8";
const IMPORT_A = "00000000-0000-0000-0000-0000000000a9";
const IMPORT_B = "00000000-0000-0000-0000-0000000000b9";
const IMPORT_FILE_A = "00000000-0000-0000-0000-0000000000ca";
const IMPORT_FILE_B = "00000000-0000-0000-0000-0000000000cb";
const CONFLICT_A = "00000000-0000-0000-0000-0000000000cc";
const CONFLICT_B = "00000000-0000-0000-0000-0000000000cd";

async function reachable(): Promise<boolean> {
  const probe = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 1500 });
  try {
    await probe.connect();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const dbUp = await reachable();

interface Case {
  name: string;
  table: string;
  idA: string;
  idB: string;
}

// Per-table: id of org A's row and org B's row, expected visible only to their member.
const cases: Case[] = [
  { name: "projects", table: "projects", idA: PROJECT_A, idB: PROJECT_B },
  { name: "interviews", table: "interviews", idA: INTERVIEW_A, idB: INTERVIEW_B },
  { name: "project_models", table: "project_models", idA: MODEL_A, idB: MODEL_B },
  { name: "generation_jobs", table: "generation_jobs", idA: JOB_A, idB: JOB_B },
  { name: "artifacts", table: "artifacts", idA: ARTIFACT_A, idB: ARTIFACT_B },
  { name: "deliveries", table: "deliveries", idA: DELIVERY_A, idB: DELIVERY_B },
  { name: "repo_connections", table: "repo_connections", idA: REPO_A, idB: REPO_B },
  { name: "import_sources", table: "import_sources", idA: IMPORT_A, idB: IMPORT_B },
  { name: "import_files", table: "import_files", idA: IMPORT_FILE_A, idB: IMPORT_FILE_B },
  { name: "import_conflicts", table: "import_conflicts", idA: CONFLICT_A, idB: CONFLICT_B }
  // `profiles` RLS is covered by auth.trigger.test.ts, which creates a real auth user
  // (profiles.id is FK'd to auth.users as of #18, so synthetic ids can't be seeded here).
];

describe.skipIf(!dbUp)("full schema RLS (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
    await cleanup();
    // Seed as superuser (bypasses RLS).
    await db.query("insert into public.organizations (id, name) values ($1, 'Org A'), ($2, 'Org B')", [ORG_A, ORG_B]);
    await db.query("insert into public.organization_members (organization_id, user_id) values ($1,$2),($3,$4)",
      [ORG_A, USER_A, ORG_B, USER_B]);
    await db.query(
      "insert into public.projects (id, organization_id, name, slug, status) values ($1,$2,'A','a','ready'),($3,$4,'B','b','ready')",
      [PROJECT_A, ORG_A, PROJECT_B, ORG_B]);
    await db.query(
      "insert into public.interviews (id, project_id, schema_version) values ($1,$2,'1'),($3,$4,'1')",
      [INTERVIEW_A, PROJECT_A, INTERVIEW_B, PROJECT_B]);
    await db.query(
      "insert into public.project_models (id, project_id, version, model) values ($1,$2,1,'{}'),($3,$4,1,'{}')",
      [MODEL_A, PROJECT_A, MODEL_B, PROJECT_B]);
    await db.query(
      "insert into public.generation_jobs (id, project_id, model_version_id, status) values ($1,$2,$3,'completed'),($4,$5,$6,'completed')",
      [JOB_A, PROJECT_A, MODEL_A, JOB_B, PROJECT_B, MODEL_B]);
    await db.query(
      "insert into public.artifacts (id, generation_job_id, result) values ($1,$2,'{}'),($3,$4,'{}')",
      [ARTIFACT_A, JOB_A, ARTIFACT_B, JOB_B]);
    await db.query(
      "insert into public.deliveries (id, project_id, job_id, method) values ($1,$2,$3,'zip'),($4,$5,$6,'zip')",
      [DELIVERY_A, PROJECT_A, JOB_A, DELIVERY_B, PROJECT_B, JOB_B]);
    await db.query(
      "insert into public.repo_connections (id, organization_id, provider, installation_id) values ($1,$2,'github','i1'),($3,$4,'github','i2')",
      [REPO_A, ORG_A, REPO_B, ORG_B]);
    await db.query(
      "insert into public.import_sources (id, project_id, kind) values ($1,$2,'zip'),($3,$4,'zip')",
      [IMPORT_A, PROJECT_A, IMPORT_B, PROJECT_B]);
    await db.query(
      "insert into public.import_files (id, import_source_id, path, bytes, digest) values ($1,$2,'README.md',10,'d1'),($3,$4,'README.md',10,'d2')",
      [IMPORT_FILE_A, IMPORT_A, IMPORT_FILE_B, IMPORT_B]);
    await db.query(
      "insert into public.import_conflicts (id, import_source_id, generation_job_id, path, resolution) values ($1,$2,$3,'README.md','keep_existing'),($4,$5,$6,'README.md','keep_existing')",
      [CONFLICT_A, IMPORT_A, JOB_A, CONFLICT_B, IMPORT_B, JOB_B]);
  });

  afterAll(async () => {
    await cleanup();
    await db.end();
  });

  async function cleanup(): Promise<void> {
    await db.query("delete from public.organizations where id = any($1)", [[ORG_A, ORG_B]]);
    await db.query("delete from public.profiles where id = any($1)", [[USER_A, USER_B]]);
  }

  // Select ids from a table as the given authenticated user, under RLS, then roll back.
  async function visibleIds(table: string, userId: string): Promise<string[]> {
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId })]);
      await db.query("select set_config('role', 'authenticated', true)");
      const res = await db.query<{ id: string }>(`select id from public.${table}`);
      return res.rows.map((r) => r.id);
    } finally {
      await db.query("rollback");
    }
  }

  for (const c of cases) {
    it(`${c.name}: a member sees their own row and is denied the other org's`, async () => {
      const visibleToA = await visibleIds(c.table, USER_A);
      expect(visibleToA).toContain(c.idA);
      expect(visibleToA).not.toContain(c.idB);

      const visibleToB = await visibleIds(c.table, USER_B);
      expect(visibleToB).toContain(c.idB);
      expect(visibleToB).not.toContain(c.idA);
    });
  }
});
