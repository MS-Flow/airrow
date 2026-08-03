// What Postgres promises about how a foundation lands (spec 187).
//
// The layout is two columns that mean one thing, and the failure worth guarding is them
// contradicting each other: a row saying `hidden` with no folder would send the delivery to `/`, and
// a row saying `integrated` while carrying a folder would leave a name that silently comes back if
// the mode is ever flipped. The unit tests above the database can prove the mapping; only this can
// prove the database refuses the states that would break it.
//
// The folder is also concatenated into every delivered path, so the same single-path-segment rule
// the Zod schema applies is enforced here — defence in depth, the way §II asks for it.
//
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Deterministic ids in their own namespace, so a parallel suite cannot collide (§V).
const ORG = "00000000-0000-0000-0000-0000000187a0";
const USER = "00000000-0000-0000-0000-0000000187a1";
const PROJECT = "00000000-0000-0000-0000-0000000187a2";

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

describe.skipIf(!dbUp)("import delivery layout (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
    await cleanup();
    await db.query(`insert into auth.users (id, email) values ($1, 'hidden-187@example.com')`, [
      USER
    ]);
    await db.query(`insert into public.organizations (id, name, slug) values ($1, 'Spec 187', $2)`, [
      ORG,
      `spec-187-${ORG.slice(-4)}`
    ]);
    await db.query(
      `insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')`,
      [ORG, USER]
    );
    await db.query(
      `insert into public.projects (id, organization_id, name, slug) values ($1, $2, 'Keystone', $3)`,
      [PROJECT, ORG, `keystone-${PROJECT.slice(-4)}`]
    );
  });

  afterAll(async () => {
    await cleanup();
    await db.end();
  });

  async function cleanup() {
    await db.query(`delete from public.projects where id = $1`, [PROJECT]);
    await db.query(`delete from public.organizations where id = $1`, [ORG]);
    await db.query(`delete from auth.users where id = $1`, [USER]);
  }

  /** Insert one import source with the given layout, returning the error message if refused. */
  async function insert(layout: string, folder: string): Promise<string | null> {
    try {
      await db.query(
        `insert into public.import_sources (project_id, kind, delivery_layout, hidden_folder)
         values ($1, 'zip', $2, $3)`,
        [PROJECT, layout, folder]
      );
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    } finally {
      await db.query(`delete from public.import_sources where project_id = $1`, [PROJECT]);
    }
  }

  it("defaults an import to integrated, so every row written before this behaves as it did", async () => {
    await db.query(`insert into public.import_sources (project_id, kind) values ($1, 'zip')`, [
      PROJECT
    ]);
    const { rows } = await db.query<{ delivery_layout: string; hidden_folder: string }>(
      `select delivery_layout, hidden_folder from public.import_sources where project_id = $1`,
      [PROJECT]
    );
    expect(rows[0]).toEqual({ delivery_layout: "integrated", hidden_folder: "" });
    await db.query(`delete from public.import_sources where project_id = $1`, [PROJECT]);
  });

  it("accepts a hidden layout with a folder name", async () => {
    expect(await insert("hidden", "notes")).toBeNull();
  });

  it("refuses a hidden layout with no folder — the delivery would land at the root", async () => {
    expect(await insert("hidden", "")).toContain("import_sources_hidden_folder_ck");
  });

  it("refuses an integrated layout carrying a folder, so the pair can never disagree", async () => {
    expect(await insert("integrated", "notes")).toContain("import_sources_hidden_folder_ck");
  });

  it("refuses a folder that would address anything but one directory", async () => {
    for (const folder of ["a/b", "..", "../escape", "/absolute", ".hidden", "Notes", "a b"]) {
      expect(await insert("hidden", folder)).toContain("import_sources_hidden_folder_ck");
    }
  });

  it("refuses a layout that is neither of the two", async () => {
    expect(await insert("stealth", "notes")).toContain("delivery_layout");
  });
});
