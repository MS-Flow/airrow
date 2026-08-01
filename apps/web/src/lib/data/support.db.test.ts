// What Postgres promises about tickets and reviews (spec 144).
//
// Two guarantees no mock can make: a founder cannot read another workspace's messages, and nobody but
// the service role can write either table. The second is the one that matters most on
// `project_reviews` — `published_at` sits on a row the founder would otherwise be allowed to update,
// so an INSERT privilege here is a self-published testimonial.
//
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

// Own '14…' namespace so a parallel run cannot collide with the other suites.
const ORG_A = "00000000-0000-0000-0000-000000000141";
const ORG_B = "00000000-0000-0000-0000-000000000142";
const USER_A = "00000000-0000-0000-0000-000000000143";
const USER_B = "00000000-0000-0000-0000-000000000144";
const PROJECT_A = "00000000-0000-0000-0000-000000000145";
const PROJECT_B = "00000000-0000-0000-0000-000000000146";
const TICKET_A = "00000000-0000-0000-0000-000000000147";
const TICKET_B = "00000000-0000-0000-0000-000000000148";
const REVIEW_A = "00000000-0000-0000-0000-000000000149";
const REVIEW_B = "00000000-0000-0000-0000-00000000014a";

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

describe.skipIf(!dbUp)("support tickets and reviews (local Supabase)", () => {
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
      `insert into public.support_tickets (id, organization_id, user_id, project_id, category, subject, body)
       values ($1,$2,$3,$4,'generation','A subject','A body'),($5,$6,$7,$8,'billing','B subject','B body')`,
      [TICKET_A, ORG_A, USER_A, PROJECT_A, TICKET_B, ORG_B, USER_B, PROJECT_B]
    );
    await db.query(
      `insert into public.project_reviews (id, organization_id, project_id, user_id, rating, body)
       values ($1,$2,$3,$4,5,'A review'),($5,$6,$7,$8,4,'B review')`,
      [REVIEW_A, ORG_A, PROJECT_A, USER_A, REVIEW_B, ORG_B, PROJECT_B, USER_B]
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

  async function visibleIds(table: string, userId: string): Promise<string[]> {
    return asUser(userId, async () => {
      const res = await db.query<{ id: string }>(`select id from public.${table}`);
      return res.rows.map((r) => r.id);
    });
  }

  it("support_tickets: a member reads their workspace's tickets and never another's", async () => {
    expect(await visibleIds("support_tickets", USER_A)).toEqual([TICKET_A]);
    expect(await visibleIds("support_tickets", USER_B)).toEqual([TICKET_B]);
  });

  it("project_reviews: a member reads their own reviews and is denied the other org's", async () => {
    expect(await visibleIds("project_reviews", USER_A)).toEqual([REVIEW_A]);
    expect(await visibleIds("project_reviews", USER_B)).toEqual([REVIEW_B]);
  });

  it("support_tickets: a member cannot write one directly, skipping the rate limit", async () => {
    await expect(
      asUser(USER_A, () =>
        db.query(
          `insert into public.support_tickets (organization_id, user_id, category, subject, body)
           values ($1,$2,'other','x','y')`,
          [ORG_A, USER_A]
        )
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("project_reviews: a member cannot publish their own review", async () => {
    // The denial that matters most: RLS cannot help, because the row is genuinely theirs. The
    // privilege is simply never granted, so publishing stays ours alone.
    await expect(
      asUser(USER_A, () => db.query("update public.project_reviews set published_at = now()"))
    ).rejects.toThrow(/permission denied/i);
  });

  it("project_reviews: a member cannot invent a review for another workspace's project", async () => {
    await expect(
      asUser(USER_B, () =>
        db.query(
          `insert into public.project_reviews (organization_id, project_id, user_id, rating)
           values ($1,$2,$3,5)`,
          [ORG_A, PROJECT_A, USER_B]
        )
      )
    ).rejects.toThrow(/permission denied/i);
  });

  it("refuses a rating outside one to five", async () => {
    await expect(
      db.query("update public.project_reviews set rating = 6 where id = $1", [REVIEW_A])
    ).rejects.toThrow(/project_reviews_rating_check/);
  });

  it("refuses a second review for the same project", async () => {
    await expect(
      db.query(
        `insert into public.project_reviews (organization_id, project_id, user_id, rating)
         values ($1,$2,$3,3)`,
        [ORG_A, PROJECT_A, USER_A]
      )
    ).rejects.toThrow(/duplicate key/);
  });

  it("keeps a ticket when the project it was about is deleted", async () => {
    // The answer is still owed after the founder gives up on the project (spec 144).
    await db.query("delete from public.projects where id = $1", [PROJECT_A]);

    const res = await db.query<{ project_id: string | null }>(
      "select project_id from public.support_tickets where id = $1",
      [TICKET_A]
    );
    expect(res.rows[0]?.project_id).toBeNull();
  });

  it("takes the review with the project, and both with the workspace", async () => {
    await db.query("delete from public.projects where id = $1", [PROJECT_A]);
    const afterProject = await db.query("select id from public.project_reviews where id = $1", [
      REVIEW_A
    ]);
    expect(afterProject.rowCount).toBe(0);

    await db.query("delete from public.organizations where id = $1", [ORG_B]);
    const afterOrg = await db.query("select id from public.support_tickets where id = $1", [
      TICKET_B
    ]);
    expect(afterOrg.rowCount).toBe(0);
  });
});
