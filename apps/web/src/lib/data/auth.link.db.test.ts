// Signing in with GitHub on an address that already has an Airrow account must land in that same
// account and that same organization (spec 67) — otherwise a founder meets an empty workspace and
// their projects appear to be gone.
//
// What makes that true is that linking adds a row to `auth.identities` and *not* to `auth.users`, so
// `on_auth_user_created` never fires a second time. This asserts it against local Supabase, by
// linking an identity the way Supabase does. Skipped when local Supabase is unreachable.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";
const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const EMAIL = "link-user@airrow.test"; // fixed — deterministic (§V)

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

describe.skipIf(!dbUp)("linking a GitHub identity to an existing account (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });
  let admin!: SupabaseClient; // assigned in beforeAll (definite assignment)
  let userId = "";

  async function deleteByEmail(email: string): Promise<void> {
    const { data } = await admin.auth.admin.listUsers();
    for (const u of data?.users ?? []) {
      if (u.email !== email) continue;
      await db.query("delete from public.organizations where created_by = $1", [u.id]);
      await admin.auth.admin.deleteUser(u.id);
    }
  }

  const countOrgs = async (): Promise<number> => {
    const res = await db.query<{ n: string }>(
      "select count(*) as n from public.organizations where created_by = $1",
      [userId]
    );
    return Number(res.rows[0]?.n ?? 0);
  };

  beforeAll(async () => {
    admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
    await db.connect();
    await deleteByEmail(EMAIL);
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: "supersecret123",
      email_confirm: true,
      user_metadata: { name: "Link User" }
    });
    if (error) throw error;
    userId = data.user.id;
  });

  afterAll(async () => {
    await db.query("delete from public.organizations where created_by = $1", [userId]);
    await deleteByEmail(EMAIL);
    await db.end();
  });

  it("keeps one account and one organization when a GitHub identity is added", async () => {
    expect(await countOrgs()).toBe(1);

    // Exactly what Supabase writes when it links a verified provider e-mail to an existing user:
    // a second identity, the same `auth.users` row.
    await db.query(
      `insert into auth.identities
         (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
       values (gen_random_uuid(), '9001', $1,
               jsonb_build_object('sub', '9001', 'email', $2::text, 'email_verified', true),
               'github', now(), now(), now())`,
      [userId, EMAIL]
    );

    const identities = await db.query(
      "select provider from auth.identities where user_id = $1 order by provider",
      [userId]
    );
    expect(identities.rows.map((r) => r.provider)).toEqual(["email", "github"]);

    // The two things a founder would notice going wrong: a second workspace, or a second membership
    // that would make `getOrgForUser` pick between them.
    expect(await countOrgs()).toBe(1);
    const members = await db.query(
      "select organization_id from public.organization_members where user_id = $1",
      [userId]
    );
    expect(members.rowCount).toBe(1);
  });
});
