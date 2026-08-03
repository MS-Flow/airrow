// What Postgres promises about the operator console (spec 150).
//
// Four guarantees no mock can make, and the first one is the reason the rest matter:
//
// 1. **A founder cannot make themselves an admin.** `20260725100000_schema.sql` granted `authenticated`
//    table-wide UPDATE on `profiles` under a policy that correctly says the row is theirs — so until
//    this spec's migration, `update profiles set is_admin = true where id = auth.uid()` worked. Every
//    other test in this file is worthless if that one regresses.
// 2. A suspended account cannot lift its own suspension.
// 3. `generation_credits` and `admin_audit_log` are reachable by nobody but the service role — a
//    founder who can insert a credit has granted themselves a generation from a browser console.
// 4. The statistics functions and the `auth.users` view are not callable or readable by `authenticated`.
//
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Own '15…' namespace so a parallel run cannot collide with the other suites.
const ORG_A = "00000000-0000-0000-0000-000000000151";
const ORG_B = "00000000-0000-0000-0000-000000000152";
const USER_A = "00000000-0000-0000-0000-000000000153";
const USER_B = "00000000-0000-0000-0000-000000000154";
const ADMIN = "00000000-0000-0000-0000-000000000155";
const CREDIT_A = "00000000-0000-0000-0000-000000000156";

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

describe.skipIf(!dbUp)("admin console (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await cleanup();
    await db.end();
  });

  /**
   * `profiles.id` references `auth.users`, so an account has to start there — and inserting one fires
   * `handle_new_user`, which provisions the profile, a personal organization and the membership. The
   * personal orgs are then removed so the fixture's own two are the only ones these tests see.
   */
  async function seedAccount(id: string, email: string): Promise<void> {
    await db.query(
      `insert into auth.users
         (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
       values ($1,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',$2,'x',now(),now(),now())`,
      [id, email]
    );
  }

  beforeEach(async () => {
    await cleanup();
    const accounts: [string, string][] = [
      [USER_A, "a@admin.test"],
      [USER_B, "b@admin.test"],
      [ADMIN, "ops@admin.test"]
    ];
    for (const [id, email] of accounts) await seedAccount(id, email);
    await db.query("delete from public.organizations where created_by = any($1)", [
      [USER_A, USER_B, ADMIN]
    ]);

    await db.query("insert into public.organizations (id, name) values ($1,'Org A'),($2,'Org B')", [
      ORG_A,
      ORG_B
    ]);
    await db.query(
      "insert into public.organization_members (organization_id, user_id) values ($1,$2),($3,$4)",
      [ORG_A, USER_A, ORG_B, USER_B]
    );
    await db.query("update public.profiles set is_admin = true where id = $1", [ADMIN]);
    await db.query(
      "insert into public.generation_credits (id, organization_id, reason, granted_by) values ($1,$2,'made whole',$3)",
      [CREDIT_A, ORG_A, ADMIN]
    );
  });

  async function cleanup(): Promise<void> {
    await db.query("delete from public.organizations where id = any($1)", [[ORG_A, ORG_B]]);
    await db.query("delete from public.admin_audit_log where actor_id = any($1)", [[ADMIN, USER_A]]);
    // Cascades the profile, its personal organization's membership and anything hanging off both.
    await db.query("delete from public.organizations where created_by = any($1)", [
      [USER_A, USER_B, ADMIN]
    ]);
    await db.query("delete from auth.users where id = any($1)", [[USER_A, USER_B, ADMIN]]);
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

  /* ── The escalation that used to work ──────────────────────────────────── */

  it("refuses a founder who tries to make themselves an admin", async () => {
    // The whole console rests on this. Before spec 150's migration this statement succeeded.
    await expect(
      asUser(USER_A, () =>
        db.query("update public.profiles set is_admin = true where id = $1", [USER_A])
      )
    ).rejects.toThrow(/permission denied/i);

    const after = await db.query<{ is_admin: boolean }>(
      "select is_admin from public.profiles where id = $1",
      [USER_A]
    );
    expect(after.rows[0]?.is_admin).toBe(false);
  });

  it("refuses a suspended founder who tries to lift their own suspension", async () => {
    await db.query("update public.profiles set suspended_at = now() where id = $1", [USER_A]);

    await expect(
      asUser(USER_A, () =>
        db.query("update public.profiles set suspended_at = null where id = $1", [USER_A])
      )
    ).rejects.toThrow(/permission denied/i);

    const after = await db.query<{ suspended_at: string | null }>(
      "select suspended_at from public.profiles where id = $1",
      [USER_A]
    );
    expect(after.rows[0]?.suspended_at).not.toBeNull();
  });

  it("still lets a founder rename themselves — the privilege was narrowed, not removed", async () => {
    // The column-level grant has to leave the legitimate write working, or Settings breaks.
    await expect(
      asUser(USER_A, () =>
        db.query("update public.profiles set display_name = 'Renamed' where id = $1", [USER_A])
      )
    ).resolves.toBeDefined();
  });

  /* ── The new tables ────────────────────────────────────────────────────── */

  it("generation_credits: a founder can neither read nor grant one", async () => {
    // RLS is on with no policy, so reads return nothing rather than erroring for a role that has
    // SELECT — but `authenticated` has no privilege at all here, which is the stronger statement.
    await expect(
      asUser(USER_A, () => db.query("select * from public.generation_credits"))
    ).rejects.toThrow(/permission denied/i);

    await expect(
      asUser(USER_A, () =>
        db.query("insert into public.generation_credits (organization_id) values ($1)", [ORG_A])
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("generation_credits: a founder cannot un-spend a credit either", async () => {
    await expect(
      asUser(USER_A, () => db.query("update public.generation_credits set consumed_at = null"))
    ).rejects.toThrow(/permission denied/i);
  });

  it("admin_audit_log: a founder cannot read what was done, or forge a row", async () => {
    await expect(
      asUser(USER_A, () => db.query("select * from public.admin_audit_log"))
    ).rejects.toThrow(/permission denied/i);

    await expect(
      asUser(USER_A, () =>
        db.query(
          `insert into public.admin_audit_log (actor_id, action, subject_type, subject_id)
           values ($1,'user.suspend','user',$2)`,
          [USER_A, USER_B]
        )
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("admin_audit_log: refuses an action or a subject it does not recognise", async () => {
    await expect(
      db.query(
        `insert into public.admin_audit_log (actor_id, action, subject_type, subject_id)
         values ($1,'user.delete','user',$2)`,
        [ADMIN, USER_A]
      )
    ).rejects.toThrow(/admin_audit_log_action_check/);

    await expect(
      db.query(
        `insert into public.admin_audit_log (actor_id, action, subject_type, subject_id)
         values ($1,'user.suspend','invoice',$2)`,
        [ADMIN, USER_A]
      )
    ).rejects.toThrow(/admin_audit_log_subject_check/);
  });

  it("admin_audit_log: accepts the two Pro actions (spec 164)", async () => {
    // The action set is closed in **Postgres**, not only in the TypeScript union — so widening
    // `recordAdminAction` without the migration would have written the grant and then had the row
    // recording it rejected, leaving Pro handed out with nothing saying who did it.
    for (const action of ["pro.grant", "pro.revoke"]) {
      await expect(
        db.query(
          `insert into public.admin_audit_log (actor_id, action, subject_type, subject_id)
           values ($1,$2,'user',$3)`,
          [ADMIN, action, USER_A]
        )
      ).resolves.toMatchObject({ rowCount: 1 });
    }
  });

  /* ── The statistics surface ────────────────────────────────────────────── */

  it("the accounts view is readable by the service role and nobody else", async () => {
    await expect(
      asUser(USER_A, () => db.query("select * from public.admin_accounts"))
    ).rejects.toThrow(/permission denied/i);

    // Proves the view exists and works, so the denial above is about privilege rather than absence.
    await expect(db.query("select * from public.admin_accounts limit 1")).resolves.toBeDefined();
  });

  it("the accounts view joins the profile to its auth record, so one query can sort by either", async () => {
    // The whole reason this view exists: `last_sign_in_at` lives in `auth.users` and the rest on
    // `profiles`, and ordering the user list by last activity means ordering on that column across the
    // *list* — which is impossible if the two are fetched separately and stitched together per page.
    await db.query("update auth.users set last_sign_in_at = now() where id = $1", [USER_A]);

    const res = await db.query<{
      id: string;
      email: string;
      display_name: string | null;
      is_admin: boolean;
      suspended_at: string | null;
      last_sign_in_at: string | null;
      email_confirmed_at: string | null;
    }>("select * from public.admin_accounts where id = any($1) order by last_sign_in_at desc nulls last", [
      [USER_A, USER_B]
    ]);

    expect(res.rows.map((r) => r.id)).toEqual([USER_A, USER_B]);
    expect(res.rows[0]?.email).toBe("a@admin.test");
    expect(res.rows[0]?.last_sign_in_at).not.toBeNull();
    expect(res.rows[1]?.last_sign_in_at).toBeNull();
  });

  it("the accounts view exposes nothing but the columns the console shows", async () => {
    // A `select *` over auth.users would put password hashes one careless grant away from a screen.
    const res = await db.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema='public' and table_name='admin_accounts'"
    );
    expect(res.rows.map((r) => r.column_name).sort()).toEqual([
      "created_at",
      "display_name",
      "email",
      "email_confirmed_at",
      "id",
      "is_admin",
      "last_sign_in_at",
      "suspended_at"
    ]);
  });

  it("every statistics function is denied to a signed-in founder", async () => {
    // Postgres grants EXECUTE to `public` by default, so each of these needed an explicit revoke.
    // Asserting them one by one because a function added later without the revoke is exactly the
    // regression this catches: it would be readable by anyone with a login.
    const calls = [
      "select * from public.admin_daily_series(current_date - 1, current_date)",
      "select * from public.admin_totals(now() - interval '1 day', now())",
      "select * from public.admin_project_status_counts()",
      "select * from public.admin_interview_progress()",
      "select * from public.admin_ticket_categories(now() - interval '1 day', now())",
      "select * from public.admin_standing()",
      "select * from public.admin_review_distribution()"
    ];
    for (const call of calls) {
      await expect(asUser(USER_A, () => db.query(call))).rejects.toThrow(/permission denied/i);
    }
  });

  it("counts what actually happened, not what still exists", async () => {
    const before = await db.query<{ credits_unspent: string }>(
      "select credits_unspent from public.admin_standing()"
    );
    expect(Number(before.rows[0]?.credits_unspent)).toBeGreaterThanOrEqual(1);

    await db.query("update public.generation_credits set consumed_at = now() where id = $1", [
      CREDIT_A
    ]);
    const after = await db.query<{ credits_unspent: string }>(
      "select credits_unspent from public.admin_standing()"
    );
    expect(Number(after.rows[0]?.credits_unspent)).toBe(Number(before.rows[0]?.credits_unspent) - 1);
  });

  it("fills empty days with zeros rather than leaving holes in the curve", async () => {
    const res = await db.query<{ day: string; signups: string }>(
      "select day, signups from public.admin_daily_series(current_date - 6, current_date)"
    );
    // generate_series is what guarantees this: seven rows for seven days, whatever happened on them.
    expect(res.rowCount).toBe(7);
    expect(res.rows.every((r) => r.signups !== null)).toBe(true);
  });

  /* ── Cascades ──────────────────────────────────────────────────────────── */

  it("takes a workspace's credits with the workspace", async () => {
    await db.query("delete from public.organizations where id = $1", [ORG_A]);
    const res = await db.query("select id from public.generation_credits where id = $1", [CREDIT_A]);
    expect(res.rowCount).toBe(0);
  });

  it("keeps the credit when the admin who granted it is removed", async () => {
    // `set null` rather than cascade: a founder keeps the generation they were promised even if the
    // colleague who promised it is gone.
    await db.query("delete from public.profiles where id = $1", [ADMIN]);
    const res = await db.query<{ granted_by: string | null }>(
      "select granted_by from public.generation_credits where id = $1",
      [CREDIT_A]
    );
    expect(res.rowCount).toBe(1);
    expect(res.rows[0]?.granted_by).toBeNull();
  });
});
