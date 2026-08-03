// What Postgres promises about the founder's reference images (spec 159).
//
// Three guarantees no mock can make: a founder cannot see another workspace's uploads, nobody but the
// service role can write a row — which is what keeps the type, size and count checks in the upload
// action from being optional — and the rows go when the project goes, so the index of a founder's
// material never outlives the project it belonged to.
//
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/*
 * Own '16…' namespace so a parallel run cannot collide with the other suites.
 *
 * It said '15…' until spec 171, and so does `admin.db.test.ts` — the comment was copied here along with
 * the ids, which made the claim false the moment it was written. Both suites seed `organizations` with
 * the same two primary keys and delete them in `cleanup()`, so whichever ran second hit a duplicate key
 * or found its rows gone. It only ever surfaced when Vitest happened to schedule them together, which is
 * why it survived two specs: adding an unrelated test file elsewhere was enough to change that.
 */
const ORG_A = "00000000-0000-0000-0000-000000000161";
const ORG_B = "00000000-0000-0000-0000-000000000162";
const USER_A = "00000000-0000-0000-0000-000000000163";
const USER_B = "00000000-0000-0000-0000-000000000164";
const PROJECT_A = "00000000-0000-0000-0000-000000000165";
const PROJECT_B = "00000000-0000-0000-0000-000000000166";
const REF_A = "00000000-0000-0000-0000-000000000167";
const REF_B = "00000000-0000-0000-0000-000000000168";

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

describe.skipIf(!dbUp)("ui references (local Supabase)", () => {
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
    await db.query("insert into public.organizations (id, name) values ($1,'Org A'),($2,'Org B')", [
      ORG_A,
      ORG_B
    ]);
    await db.query(
      "insert into public.organization_members (organization_id, user_id) values ($1,$2),($3,$4)",
      [ORG_A, USER_A, ORG_B, USER_B]
    );
    await db.query(
      "insert into public.projects (id, organization_id, name, slug) values ($1,$2,'A','a'),($3,$4,'B','b')",
      [PROJECT_A, ORG_A, PROJECT_B, ORG_B]
    );
    await db.query(
      `insert into public.ui_references (id, organization_id, project_id, storage_path, media_type, bytes, created_by)
       values ($1,$2,$3,'projects/a/one.png','image/png',1024,$4),
              ($5,$6,$7,'projects/b/one.png','image/png',2048,$8)`,
      [REF_A, ORG_A, PROJECT_A, USER_A, REF_B, ORG_B, PROJECT_B, USER_B]
    );
  });

  async function cleanup(): Promise<void> {
    await db.query("delete from public.organizations where id = any($1)", [[ORG_A, ORG_B]]);
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

  it("a member reads their own workspace's references and never another's", async () => {
    const visible = async (userId: string) =>
      asUser(userId, async () => {
        const res = await db.query<{ id: string }>("select id from public.ui_references");
        return res.rows.map((r) => r.id);
      });

    expect(await visible(USER_A)).toEqual([REF_A]);
    expect(await visible(USER_B)).toEqual([REF_B]);
  });

  it("a member cannot write a row directly, skipping the type, size and count checks", async () => {
    await expect(
      asUser(USER_A, () =>
        db.query(
          `insert into public.ui_references (organization_id, project_id, storage_path, media_type, bytes, created_by)
           values ($1,$2,'projects/a/two.png','image/png',10,$3)`,
          [ORG_A, PROJECT_A, USER_A]
        )
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("a member cannot point a row at another workspace's project", async () => {
    await expect(
      asUser(USER_B, () =>
        db.query(
          `insert into public.ui_references (organization_id, project_id, storage_path, media_type, bytes, created_by)
           values ($1,$2,'projects/a/three.png','image/png',10,$3)`,
          [ORG_A, PROJECT_A, USER_B]
        )
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("a member cannot delete or repoint someone's reference", async () => {
    await expect(
      asUser(USER_A, () => db.query("delete from public.ui_references"))
    ).rejects.toThrow(/permission denied/i);
    await expect(
      asUser(USER_A, () => db.query("update public.ui_references set storage_path = 'x'"))
    ).rejects.toThrow(/permission denied/i);
  });

  it("refuses anything that is not one of the three image types", async () => {
    await expect(
      db.query(
        `insert into public.ui_references (organization_id, project_id, storage_path, media_type, bytes, created_by)
         values ($1,$2,'projects/a/four.svg','image/svg+xml',10,$3)`,
        [ORG_A, PROJECT_A, USER_A]
      )
    ).rejects.toThrow(/ui_references_media_type_check/);
  });

  it("refuses an image over the ceiling the upload action enforces", async () => {
    await expect(
      db.query(
        `insert into public.ui_references (organization_id, project_id, storage_path, media_type, bytes, created_by)
         values ($1,$2,'projects/a/five.png','image/png',2097153,$3)`,
        [ORG_A, PROJECT_A, USER_A]
      )
    ).rejects.toThrow(/ui_references_bytes_check/);
  });

  it("refuses two rows pointing at one object", async () => {
    await expect(
      db.query(
        `insert into public.ui_references (organization_id, project_id, storage_path, media_type, bytes, created_by)
         values ($1,$2,'projects/a/one.png','image/png',10,$3)`,
        [ORG_A, PROJECT_A, USER_A]
      )
    ).rejects.toThrow(/duplicate key/);
  });

  it("takes the references with the project, and both with the workspace", async () => {
    await db.query("delete from public.projects where id = $1", [PROJECT_A]);
    const afterProject = await db.query("select id from public.ui_references where id = $1", [REF_A]);
    expect(afterProject.rowCount).toBe(0);

    await db.query("delete from public.organizations where id = $1", [ORG_B]);
    const afterOrg = await db.query("select id from public.ui_references where id = $1", [REF_B]);
    expect(afterOrg.rowCount).toBe(0);
  });

  it("keeps the bucket private, so an object is only ever reached through a signed URL", async () => {
    const res = await db.query<{ public: boolean }>(
      "select public from storage.buckets where id = 'ui-references'"
    );
    expect(res.rows[0]?.public).toBe(false);
  });
});
