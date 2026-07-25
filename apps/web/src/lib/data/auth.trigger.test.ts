// handle_new_user() signup trigger + profiles→auth.users FK (issue #18). Creates a real
// auth user via the admin API against local Supabase and asserts the personal org,
// owner membership, and profile are provisioned — and that deleting the auth user
// cascades the profile. Skipped when local Supabase is unreachable.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const EMAIL = "trigger-user@airrow.test"; // fixed — deterministic (§V)
const EMAIL_B = "trigger-user-b@airrow.test";

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

describe.skipIf(!dbUp)("handle_new_user signup trigger (local Supabase)", () => {
  // Constructed in beforeAll, not here: the describe factory body runs during collection
  // even when skipIf() skips the tests, and createClient() spins up a RealtimeClient that
  // needs a WebSocket (absent on Node < 22 in CI). Lazy construction keeps the skip clean.
  const db = new Client({ connectionString: DB_URL });
  let admin!: SupabaseClient; // assigned in beforeAll (definite assignment)
  let userId = "";
  let userIdB = "";

  async function deleteByEmail(email: string): Promise<void> {
    const { data } = await admin.auth.admin.listUsers();
    for (const u of data?.users ?? []) {
      if (u.email === email) {
        await db.query("delete from public.organizations where created_by = $1", [u.id]);
        await admin.auth.admin.deleteUser(u.id);
      }
    }
  }

  async function createUser(email: string, name: string): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: "supersecret123",
      email_confirm: true,
      user_metadata: { name }
    });
    if (error) throw error;
    return data.user.id;
  }

  beforeAll(async () => {
    admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
    await db.connect();
    await deleteByEmail(EMAIL);
    await deleteByEmail(EMAIL_B);
    userId = await createUser(EMAIL, "Trigger User");
    userIdB = await createUser(EMAIL_B, "Other User");
  });

  afterAll(async () => {
    await db.query("delete from public.organizations where created_by = any($1)", [[userId, userIdB]]);
    await deleteByEmail(EMAIL);
    await deleteByEmail(EMAIL_B);
    await db.end();
  });

  it("provisions a profile, a personal org, and an owner membership", async () => {
    const profile = await db.query("select display_name from public.profiles where id = $1", [userId]);
    expect(profile.rowCount).toBe(1);
    expect(profile.rows[0].display_name).toBe("Trigger User");

    const org = await db.query(
      "select id from public.organizations where created_by = $1 and kind = 'personal'",
      [userId]
    );
    expect(org.rowCount).toBe(1);

    const member = await db.query(
      "select role from public.organization_members where user_id = $1",
      [userId]
    );
    expect(member.rowCount).toBe(1);
    expect(member.rows[0].role).toBe("owner");
  });

  // Read profiles under RLS as the given user, then roll back.
  async function profilesVisibleTo(uid: string): Promise<string[]> {
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: uid })]);
      await db.query("select set_config('role', 'authenticated', true)");
      const res = await db.query<{ id: string }>("select id from public.profiles");
      return res.rows.map((r) => r.id);
    } finally {
      await db.query("rollback");
    }
  }

  it("lets a user read their own profile and denies another's (RLS)", async () => {
    const visibleToA = await profilesVisibleTo(userId);
    expect(visibleToA).toContain(userId);
    expect(visibleToA).not.toContain(userIdB);

    const visibleToB = await profilesVisibleTo(userIdB);
    expect(visibleToB).toContain(userIdB);
    expect(visibleToB).not.toContain(userId);
  });

  it("cascades the profile when the auth user is deleted", async () => {
    await admin.auth.admin.deleteUser(userId);
    const profile = await db.query("select id from public.profiles where id = $1", [userId]);
    expect(profile.rowCount).toBe(0);
  });
});
