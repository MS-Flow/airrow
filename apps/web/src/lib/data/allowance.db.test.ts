// The bug: the allowance counted rows in `generation_jobs`, and those cascade away with their
// project. A founder who hit the limit deleted a project and generated again — the ceiling was
// refundable, which is no ceiling at all. Every generation is a paid Claude call whether or not the
// project it produced still exists.
//
// Asserted against real Postgres because the whole thing is cascade behaviour and a trigger: mocks
// cannot see either, and the unit tests were green the entire time it was broken.
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Own 'f…' namespace so a parallel run against the same DB cannot collide with the other suites.
const ORG = "00000000-0000-0000-0000-0000000000f1";
const USER = "00000000-0000-0000-0000-0000000000f2";
const PROJECT = "00000000-0000-0000-0000-0000000000f3";
const MODEL = "00000000-0000-0000-0000-0000000000f4";

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

describe.skipIf(!dbUp)("generation allowance ledger (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await cleanup();
    await db.end();
  });

  beforeEach(async () => {
    await cleanup();
    await db.query("insert into public.organizations (id, name) values ($1, 'Ledger Org')", [ORG]);
    await db.query(
      "insert into public.organization_members (organization_id, user_id) values ($1,$2)",
      [ORG, USER]
    );
    await seedProject();
  });

  async function cleanup(): Promise<void> {
    await db.query("delete from public.organizations where id = $1", [ORG]);
  }

  async function seedProject(): Promise<void> {
    await db.query(
      "insert into public.projects (id, organization_id, name, slug, status) values ($1,$2,'Ledger','ledger-fixture','ready')",
      [PROJECT, ORG]
    );
    await db.query(
      "insert into public.project_models (id, project_id, version, model) values ($1,$2,1,'{}')",
      [MODEL, PROJECT]
    );
  }

  async function startGeneration(): Promise<void> {
    await db.query(
      "insert into public.generation_jobs (project_id, model_version_id, status) values ($1,$2,'completed')",
      [PROJECT, MODEL]
    );
  }

  async function usage(): Promise<number> {
    const res = await db.query<{ n: string }>(
      "select count(*)::text as n from public.generation_usage where organization_id = $1",
      [ORG]
    );
    return Number(res.rows[0]!.n);
  }

  it("records a generation without the app having to remember to", async () => {
    // The trigger, not the call site. Two code paths create jobs today and a third would be easy to
    // add; the ledger cannot be forgotten if the database writes it.
    await startGeneration();

    expect(await usage()).toBe(1);
  });

  it("keeps the record when the project is deleted", async () => {
    // The regression, in one assertion. Deleting a project used to refund the generation.
    await startGeneration();
    await startGeneration();

    await db.query("delete from public.projects where id = $1", [PROJECT]);

    expect(await usage()).toBe(2);
  });

  it("does not hand back an allowance when a deleted project is replaced", async () => {
    // What the founder actually did: hit the limit, deleted a project, started a new one.
    await startGeneration();
    await startGeneration();
    await db.query("delete from public.projects where id = $1", [PROJECT]);
    await seedProject();
    await startGeneration();

    expect(await usage()).toBe(3);
  });

  it("orphans the reference rather than the row, so the ledger stays readable", async () => {
    await startGeneration();
    await db.query("delete from public.projects where id = $1", [PROJECT]);

    const res = await db.query<{ project_id: string | null; organization_id: string }>(
      "select project_id, organization_id from public.generation_usage where organization_id = $1",
      [ORG]
    );
    expect(res.rows[0]?.project_id).toBeNull();
    expect(res.rows[0]?.organization_id).toBe(ORG);
  });

  it("goes away with the organization, which is the one deletion that should clear it", async () => {
    // Account closure is not allowance evasion: there is no account left to spend from.
    await startGeneration();
    await db.query("delete from public.organizations where id = $1", [ORG]);

    expect(await usage()).toBe(0);
  });
});
