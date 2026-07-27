// The bug: clicking regenerate on a finished project hung on "generating" forever.
//
// `latestJob` ordered by `started_at desc nulls last`, and a job is created with `started_at = null`
// — it is only set when the job starts running. So the newly queued job sorted *behind* the
// completed one it was meant to replace. The start endpoint asked for the latest job, got a
// completed one, and refused to run anything; the poll reported that same completed job; the
// project sat on `generating`.
//
// This is a fact about SQL ordering over a real table, so it is asserted against real Postgres.
// Mocks cannot see it — the app-level tests were green throughout.
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Deterministic fixture ids in their own 'e…' namespace, so a parallel run against the same DB
// cannot collide with the RLS suites (constitution §V — no randomness).
const ORG = "00000000-0000-0000-0000-0000000000e1";
const USER = "00000000-0000-0000-0000-0000000000e2";
const PROJECT = "00000000-0000-0000-0000-0000000000e3";
const MODEL = "00000000-0000-0000-0000-0000000000e4";
const OLD_JOB = "00000000-0000-0000-0000-0000000000e5";
const NEW_JOB = "00000000-0000-0000-0000-0000000000e6";

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

describe.skipIf(!dbUp)("latest generation job (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
    await cleanup();
    await db.query("insert into public.organizations (id, name) values ($1, 'Order Org')", [ORG]);
    await db.query(
      "insert into public.organization_members (organization_id, user_id) values ($1,$2)",
      [ORG, USER]
    );
    await db.query(
      "insert into public.projects (id, organization_id, name, slug, status) values ($1,$2,'Order','order-fixture','generating')",
      [PROJECT, ORG]
    );
    await db.query(
      "insert into public.project_models (id, project_id, version, model) values ($1,$2,1,'{}')",
      [MODEL, PROJECT]
    );

    // A finished generation from an hour ago: started, heartbeat bumped as it ran, done.
    await db.query(
      `insert into public.generation_jobs
         (id, project_id, model_version_id, status, created_at, started_at, heartbeat_at, finished_at)
       values ($1,$2,$3,'completed', now() - interval '1 hour', now() - interval '1 hour',
               now() - interval '59 minutes', now() - interval '59 minutes')`,
      [OLD_JOB, PROJECT, MODEL]
    );
    // Regenerate, just now: queued, never started, so `started_at` is null — exactly the shape that
    // used to make this job invisible.
    await db.query(
      "insert into public.generation_jobs (id, project_id, model_version_id, status) values ($1,$2,$3,'queued')",
      [NEW_JOB, PROJECT, MODEL]
    );
  });

  afterAll(async () => {
    await cleanup();
    await db.end();
  });

  async function cleanup(): Promise<void> {
    await db.query("delete from public.organizations where id = $1", [ORG]);
    await db.query("delete from public.projects where id = $1", [PROJECT]);
  }

  /** The ordering `latestJob` uses, run against the real table. */
  async function latestJobId(): Promise<string> {
    const res = await db.query<{ id: string }>(
      "select id from public.generation_jobs where project_id = $1 order by created_at desc limit 1",
      [PROJECT]
    );
    return res.rows[0]!.id;
  }

  it("is the job that was queued most recently, not the one that ran most recently", async () => {
    expect(await latestJobId()).toBe(NEW_JOB);
  });

  it("finds the new job even though it has never started", async () => {
    // The regression in one assertion: a queued job has no `started_at`, and that must not be what
    // decides whether it can be found.
    const res = await db.query<{ started_at: string | null }>(
      "select started_at from public.generation_jobs where id = $1",
      [NEW_JOB]
    );
    expect(res.rows[0]?.started_at).toBeNull();
    expect(await latestJobId()).toBe(NEW_JOB);
  });

  it("orders on a column nothing updates, so a heartbeat cannot reorder history", async () => {
    // `heartbeat_at` moves on every write. If ordering depended on it, touching an old job — which
    // the stale-job check in the poll route does — would make it the "latest" again.
    await db.query("update public.generation_jobs set heartbeat_at = now() where id = $1", [OLD_JOB]);

    expect(await latestJobId()).toBe(NEW_JOB);
  });
});
