// RLS access + denial test for the proof-of-concept `organizations` table (issue #9).
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable so
// the default suite stays green without Docker. Point it elsewhere with SUPABASE_DB_URL.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Deterministic fixture ids — no randomness (constitution §V).
const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";
const USER_A = "00000000-0000-0000-0000-0000000000a1";
const USER_B = "00000000-0000-0000-0000-0000000000b1";

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

describe.skipIf(!dbUp)("organizations RLS (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
    // Seed as the superuser (bypasses RLS). Cascade clears memberships.
    await db.query("delete from public.organizations where id = any($1)", [[ORG_A, ORG_B]]);
    await db.query("insert into public.organizations (id, name) values ($1, 'Org A'), ($2, 'Org B')", [
      ORG_A,
      ORG_B
    ]);
    await db.query(
      "insert into public.organization_members (organization_id, user_id) values ($1, $2), ($3, $4)",
      [ORG_A, USER_A, ORG_B, USER_B]
    );
  });

  afterAll(async () => {
    await db.query("delete from public.organizations where id = any($1)", [[ORG_A, ORG_B]]);
    await db.end();
  });

  // Run `read` as the given authenticated user, under RLS, then roll back.
  async function asUser(userId: string): Promise<string[]> {
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId })
      ]);
      await db.query("select set_config('role', 'authenticated', true)");
      const res = await db.query<{ id: string }>("select id from public.organizations order by name");
      return res.rows.map((r) => r.id);
    } finally {
      await db.query("rollback");
    }
  }

  it("lets a member read only their own organization", async () => {
    expect(await asUser(USER_A)).toEqual([ORG_A]);
    expect(await asUser(USER_B)).toEqual([ORG_B]);
  });

  it("denies a member access to another organization", async () => {
    const visibleToA = await asUser(USER_A);
    expect(visibleToA).not.toContain(ORG_B);
  });
});
