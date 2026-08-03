// What Postgres promises about invitations and the weeks they earn (spec 122).
//
// The unit tests own the arithmetic. These own the guarantees no mock can make: that a founder cannot
// read another workspace's invitations, that nobody but the service role can write a `plan_grants`
// row — granting yourself Pro is the whole attack — and that the constraints doing the idempotence
// work are actually on the table rather than only in the code above it.
//
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Own '12…' namespace so a parallel run cannot collide with the other suites.
const ORG_A = "00000000-0000-0000-0000-000000000121";
const ORG_B = "00000000-0000-0000-0000-000000000122";
const USER_A = "00000000-0000-0000-0000-000000000123";
const USER_B = "00000000-0000-0000-0000-000000000124";
const GRANT_A = "00000000-0000-0000-0000-000000000125";
const GRANT_B = "00000000-0000-0000-0000-000000000126";
const REFERRAL_A = "00000000-0000-0000-0000-000000000127";
/** A third workspace, so "somebody else claims the same invitee" can be expressed at all. */
const ORG_C = "00000000-0000-0000-0000-000000000128";

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

describe.skipIf(!dbUp)("referrals and plan grants (local Supabase)", () => {
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
    await db.query(
      "insert into public.organizations (id, name) values ($1,'Org A'),($2,'Org B'),($3,'Org C')",
      [ORG_A, ORG_B, ORG_C]
    );
    await db.query(
      "insert into public.organization_members (organization_id, user_id) values ($1,$2),($3,$4)",
      [ORG_A, USER_A, ORG_B, USER_B]
    );
    await db.query("insert into public.referral_codes (organization_id, code) values ($1,$2),($3,$4)", [
      ORG_A,
      "code-a",
      ORG_B,
      "code-b"
    ]);
    // A referred B: the row belongs to A's list, and B is never told it is on it.
    await db.query(
      "insert into public.referrals (id, referrer_organization_id, referred_organization_id) values ($1,$2,$3)",
      [REFERRAL_A, ORG_A, ORG_B]
    );
    await db.query(
      "insert into public.plan_grants (id, organization_id, duration_days) values ($1,$2,7),($3,$4,7)",
      [GRANT_A, ORG_A, GRANT_B, ORG_B]
    );
  });

  async function cleanup(): Promise<void> {
    await db.query("delete from public.organizations where id = any($1)", [[ORG_A, ORG_B, ORG_C]]);
  }

  /** Run as an authenticated user, under RLS, then roll back whatever it did. */
  async function asUser<T>(userId: string, run: () => Promise<T>): Promise<T> {
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId })
      ]);
      await db.query("select set_config('role', 'authenticated', true)");
      return await run();
    } finally {
      await db.query("rollback");
    }
  }

  async function visibleIds(table: string, userId: string): Promise<string[]> {
    return asUser(userId, async () => {
      const res = await db.query<{ id: string }>(`select id from public.${table}`);
      return res.rows.map((r) => r.id);
    });
  }

  it("referral_codes: a member reads their own code and never another workspace's", async () => {
    const seen = await asUser(USER_A, async () => {
      const res = await db.query<{ code: string }>("select code from public.referral_codes");
      return res.rows.map((r) => r.code);
    });

    expect(seen).toEqual(["code-a"]);
  });

  it("plan_grants: a member sees their own grant and is denied the other org's", async () => {
    const visibleToA = await visibleIds("plan_grants", USER_A);
    expect(visibleToA).toContain(GRANT_A);
    expect(visibleToA).not.toContain(GRANT_B);

    const visibleToB = await visibleIds("plan_grants", USER_B);
    expect(visibleToB).toContain(GRANT_B);
    expect(visibleToB).not.toContain(GRANT_A);
  });

  it("referrals: the inviter sees the row and the invited workspace does not", async () => {
    // Deliberate: who recommended Airrow to whom is the inviter's business, and nobody is told they
    // were somebody's reward.
    expect(await visibleIds("referrals", USER_A)).toEqual([REFERRAL_A]);
    expect(await visibleIds("referrals", USER_B)).toEqual([]);
  });

  it("plan_grants: a member cannot grant themselves a week", async () => {
    // The denial that matters most. RLS cannot help here — the row they would insert *is* for their
    // own organization — so the privilege is simply never granted.
    await expect(
      asUser(USER_B, () =>
        db.query("insert into public.plan_grants (organization_id, duration_days) values ($1, 3650)", [
          ORG_B
        ])
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("plan_grants: a member cannot extend a week they already have", async () => {
    await expect(
      asUser(USER_A, () =>
        db.query("update public.plan_grants set expires_at = now() + interval '10 years'")
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("referrals: a member cannot invent one for themselves", async () => {
    await expect(
      asUser(USER_B, () =>
        db.query(
          "insert into public.referrals (referrer_organization_id, referred_organization_id) values ($1,$2)",
          [ORG_B, ORG_A]
        )
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("refuses a workspace referring itself", async () => {
    await expect(
      db.query(
        "insert into public.referrals (referrer_organization_id, referred_organization_id) values ($1,$1)",
        [ORG_A]
      )
    ).rejects.toThrow(/referrals_not_self/);
  });

  it("refuses a second referral for the same invited workspace", async () => {
    // The constraint that makes attachment idempotent under a link clicked twice — a check-then-insert
    // in application code would race with exactly the traffic this sees.
    await expect(
      db.query(
        "insert into public.referrals (referrer_organization_id, referred_organization_id) values ($1,$2)",
        [ORG_C, ORG_B]
      )
    ).rejects.toThrow(/referrals_referred_organization_id_key|duplicate key/);
  });

  it("refuses a grant that starts without ending", async () => {
    // A row with a start and no end is Pro forever, which is the one shape of this table that would
    // cost real money.
    await expect(
      db.query(
        "insert into public.plan_grants (organization_id, duration_days, starts_at) values ($1, 7, now())",
        [ORG_A]
      )
    ).rejects.toThrow(/plan_grants_window_check/);
  });

  it("accepts a support grant, and still nothing else (spec 164)", async () => {
    // The constraint was widened by one value, and the point of pinning it is that it was widened by
    // *one*: a source nobody has written a migration for is still refused.
    await expect(
      db.query(
        "insert into public.plan_grants (organization_id, source, duration_days, starts_at, expires_at) values ($1, 'support', 30, now(), now() + interval '30 days')",
        [ORG_A]
      )
    ).resolves.toMatchObject({ rowCount: 1 });

    await expect(
      db.query(
        "insert into public.plan_grants (organization_id, source, duration_days) values ($1, 'because-i-said-so', 30)",
        [ORG_A]
      )
    ).rejects.toThrow(/plan_grants_source_check/);
  });

  it("still lets nobody but the service role write a support grant (spec 164)", async () => {
    // Widening the constraint must not have widened the privilege — this is the attack the table was
    // built to refuse, and a new source value is exactly the moment to re-check it.
    await expect(
      asUser(USER_B, () =>
        db.query(
          "insert into public.plan_grants (organization_id, source, duration_days, starts_at, expires_at) values ($1, 'support', 3650, now(), now() + interval '10 years')",
          [ORG_B]
        )
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("takes the grants and referrals with the workspace when it is deleted", async () => {
    await db.query("delete from public.organizations where id = $1", [ORG_B]);

    const grants = await db.query("select id from public.plan_grants where id = $1", [GRANT_B]);
    const referrals = await db.query("select id from public.referrals where id = $1", [REFERRAL_A]);
    expect(grants.rowCount).toBe(0);
    // A referral is about two workspaces; losing either leaves nothing to be about.
    expect(referrals.rowCount).toBe(0);
  });
});
