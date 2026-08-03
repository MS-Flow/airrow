// The layer's own refusal, and the consent rule (spec 150).
//
// `lib/data/admin.ts` is the module that crosses the tenancy boundary, so it does not take the page
// gate's word for it: every exported function re-checks `is_admin` itself. These tests are what stop
// that guarantee decaying into a comment — a function added later without the check fails here.
//
// The publication rule is tested at this layer for the same reason it *lives* at this layer: the form
// hides the button and the action calls this, but neither is what makes an unconsented review
// unpublishable.
import { describe, it, expect, vi, beforeEach } from "vitest";

const profileFlags = vi.hoisted(() => vi.fn());
vi.mock("./store", () => ({ profileFlags }));

const creditsAvailableFor = vi.hoisted(() => vi.fn(async () => new Map<string, number>()));
vi.mock("./credits", () => ({ creditsAvailableFor }));

/**
 * A minimal PostgREST double.
 *
 * The reads under test are all "select, filter, hand back rows", so one recording builder covers the
 * lot. `rows` is what any terminal await resolves to, and `updates` records what a write was asked to
 * do — which is the assertion for the publication rule.
 */
const state = vi.hoisted(() => ({
  rows: [] as unknown[],
  /**
   * Rows for one named table, when a test needs two tables to answer differently.
   *
   * `rows` alone was enough while every function under test read a single table; granting Pro reads
   * the organization's plan *and* its existing grants, and a shared list cannot say two things.
   * Falls back to `rows`, so every test written before this keeps working unchanged.
   */
  rowsFor: {} as Record<string, unknown[]>,
  /** What PostgREST answers for one table, when a test is about a failure rather than a result. */
  errorFor: {} as Record<string, { message: string; code: string }>,
  updates: [] as { table: string; payload: unknown }[],
  inserts: [] as { table: string; payload: unknown }[],
  /** Every filter the builder was asked for, so "in the database" can be asserted rather than hoped. */
  calls: [] as { table: string; method: string; args: unknown[] }[]
}));

const db = vi.hoisted(() => () => {
  const make = (table: string) => {
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "is", "not", "or", "order", "range", "limit", "gte"]) {
      builder[method] = (...args: unknown[]) => {
        state.calls.push({ table, method, args });
        return builder;
      };
    }
    builder.update = (payload: unknown) => {
      state.updates.push({ table, payload });
      return builder;
    };
    builder.insert = (payload: unknown) => {
      state.inserts.push({ table, payload });
      return builder;
    };
    // Awaiting the builder is what PostgREST does at the end of a chain.
    builder.then = (
      resolve: (value: { data: unknown; error: { message: string; code: string } | null }) => unknown
    ) =>
      resolve({
        data: state.rowsFor[table] ?? state.rows,
        error: state.errorFor[table] ?? null
      });
    return builder;
  };
  return { from: (table: string) => make(table) };
});
vi.mock("./supabase", async () => {
  const actual = await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, db };
});

import {
  adminAudit,
  adminProjectFiles,
  adminProjects,
  adminReviews,
  adminTickets,
  adminUsers,
  grantSupportPro,
  recordAdminAction,
  revokeActiveGrant,
  setReviewPublished,
  setTicketStatus,
  setUserSuspended
} from "./admin";

const ACTOR = "actor-1";

beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [];
  state.rowsFor = {};
  state.errorFor = {};
  state.updates = [];
  state.inserts = [];
  state.calls = [];
  profileFlags.mockResolvedValue({ isAdmin: true, suspendedAt: null });
});

/** What the builder was asked to do on one table. */
const callsOn = (table: string, method: string): unknown[][] =>
  state.calls.filter((c) => c.table === table && c.method === method).map((c) => c.args);

/** The first such call's arguments, failing loudly when it never happened. */
function firstCall(table: string, method: string): unknown[] {
  const args = callsOn(table, method)[0];
  if (!args) throw new Error(`expected a .${method}() on ${table}, and there was none`);
  return args;
}

describe("every admin read refuses a non-admin", () => {
  /**
   * Named one by one rather than looped over the module's exports, so adding a function without a
   * check is a failing test rather than a silently untested export.
   */
  const reads: [string, () => Promise<unknown>][] = [
    ["adminUsers", () => adminUsers(ACTOR)],
    ["adminProjects", () => adminProjects(ACTOR)],
    ["adminTickets", () => adminTickets(ACTOR)],
    ["adminReviews", () => adminReviews(ACTOR)],
    ["adminAudit", () => adminAudit(ACTOR, { type: "user", ids: ["u1"] })],
    ["setTicketStatus", () => setTicketStatus(ACTOR, "t1", "closed")],
    ["setReviewPublished", () => setReviewPublished(ACTOR, "r1", true)],
    [
      "recordAdminAction",
      () =>
        recordAdminAction({
          actorId: ACTOR,
          action: "user.suspend",
          subjectType: "user",
          subjectId: "u1"
        })
    ],
    ["setUserSuspended", () => setUserSuspended(ACTOR, "u1", true)],
    ["grantSupportPro", () => grantSupportPro(ACTOR, "org1", 30)],
    ["revokeActiveGrant", () => revokeActiveGrant(ACTOR, "org1")],
    [
      "adminProjectFiles",
      () => adminProjectFiles(ACTOR, "proj1", null, async () => [], async () => [])
    ]
  ];

  it.each(reads)("%s", async (_name, call) => {
    profileFlags.mockResolvedValue({ isAdmin: false, suspendedAt: null });
    await expect(call()).rejects.toThrow(/refused/i);
  });

  it.each(reads)("%s reads nothing before checking", async (_name, call) => {
    profileFlags.mockResolvedValue({ isAdmin: false, suspendedAt: null });
    state.rows = [{ id: "should-never-be-read" }];

    await expect(call()).rejects.toThrow(/refused/i);
    // The check is at the top of every function, so a refused caller must not have written either.
    expect(state.updates).toHaveLength(0);
    expect(state.inserts).toHaveLength(0);
  });
});

/**
 * The lists have to page and filter **in Postgres**.
 *
 * This is the criterion that quietly decays: a version that fetched every row and sliced it in
 * JavaScript passes every other test in this file and every screenshot, and then stops working on the
 * day we have enough users for it to matter. So the query itself is asserted, not the result.
 */
describe("the lists page and filter in the database", () => {
  const lists: [string, string, (page: number) => Promise<unknown>][] = [
    ["adminUsers", "admin_accounts", (page) => adminUsers(ACTOR, { page })],
    ["adminProjects", "projects", (page) => adminProjects(ACTOR, { page })],
    ["adminTickets", "support_tickets", (page) => adminTickets(ACTOR, { page })],
    ["adminReviews", "project_reviews", (page) => adminReviews(ACTOR, { page })]
  ];

  it.each(lists)("%s asks Postgres for one page, not the table", async (_name, table, call) => {
    await call(0);

    // `range` is the whole assertion: its presence means the database is doing the paging.
    expect(callsOn(table, "range")).toEqual([[0, 25]]);
  });

  it.each(lists)("%s moves the window rather than skipping rows in memory (%s)", async (_name, table, call) => {
    await call(2);

    expect(callsOn(table, "range")).toEqual([[50, 75]]);
  });

  it.each(lists)("%s asks for one row more than it shows (%s)", async (_name, table, call) => {
    // 25 shown, 26 fetched — that extra row is how "is there a next page" is answered without a
    // second counting query.
    await call(0);
    const [from, to] = firstCall(table, "range") as [number, number];

    expect(to - from).toBe(25);
  });

  it("searches users in the database rather than filtering the page", async () => {
    await adminUsers(ACTOR, { search: "ada" });

    const [filter] = firstCall("admin_accounts", "or") as [string];
    expect(filter).toContain("email.ilike.%ada%");
    expect(filter).toContain("display_name.ilike.%ada%");
  });

  it("strips the characters that would let a search box become another filter", async () => {
    // PostgREST parses `or` as a comma-separated filter list, so an unescaped comma in a search term
    // is not a typo — it is a second filter the founder did not ask for.
    await adminUsers(ACTOR, { search: "a,b)(%c" });

    const [filter] = firstCall("admin_accounts", "or") as [string];
    expect(filter).toBe("email.ilike.%abc%,display_name.ilike.%abc%");
  });

  /**
   * Sorting has to reach Postgres, not the page (spec 150, fixed after `/analyze`).
   *
   * "Sorted by last activity" applied to twenty-five already-chosen rows is not a sorted list — it is
   * a sorted page, which is a different and much less useful thing. The column ordered on is the
   * assertion, because that is what says the database did it.
   */
  it("orders the whole list in Postgres, newest signup first by default", async () => {
    await adminUsers(ACTOR);

    expect(firstCall("admin_accounts", "order")).toEqual([
      "created_at",
      { ascending: false, nullsFirst: false }
    ]);
  });

  it("orders by last activity when asked, out of the joined view", async () => {
    await adminUsers(ACTOR, { sort: "activity" });

    expect(firstCall("admin_accounts", "order")).toEqual([
      "last_sign_in_at",
      { ascending: false, nullsFirst: false }
    ]);
  });

  it("puts accounts that never signed in last rather than first", async () => {
    // `nullsFirst: false` is the whole point: a null last-activity means "never", and Postgres sorts
    // nulls first on a descending order unless told otherwise — which would rank everyone who has
    // never signed in above everyone who just did.
    await adminUsers(ACTOR, { sort: "activity", ascending: false });

    const [, options] = firstCall("admin_accounts", "order") as [string, { nullsFirst: boolean }];
    expect(options.nullsFirst).toBe(false);
  });

  it("reverses on request", async () => {
    await adminUsers(ACTOR, { sort: "signup", ascending: true });

    const [, options] = firstCall("admin_accounts", "order") as [string, { ascending: boolean }];
    expect(options.ascending).toBe(true);
  });

  /**
   * Origin is decided in the query (spec 150, fixed after `/analyze`).
   *
   * It used to be a JavaScript filter applied *after* the database had already sized the page — so a
   * page could come back short, and `Pager` read a short page as the end of the list. An operator
   * filtering to imported projects was shown a partial answer as though it were complete.
   */
  it("asks Postgres for imported projects with an inner join", async () => {
    await adminProjects(ACTOR, { origin: "imported" });

    const [columns] = firstCall("projects", "select") as [string];
    expect(columns).toContain("import_sources!inner(kind)");
  });

  it("asks Postgres for from-scratch projects with a left join and is-null", async () => {
    await adminProjects(ACTOR, { origin: "scratch" });

    const [columns] = firstCall("projects", "select") as [string];
    expect(columns).toContain("import_sources(kind)");
    expect(columns).not.toContain("!inner");
    expect(callsOn("projects", "is")).toContainEqual(["import_sources", null]);
  });

  it("embeds the origin without filtering when no origin is asked for", async () => {
    await adminProjects(ACTOR);

    const [columns] = firstCall("projects", "select") as [string];
    expect(columns).toContain("import_sources(kind)");
    expect(columns).not.toContain("!inner");
    expect(callsOn("projects", "is")).not.toContainEqual(["import_sources", null]);
  });

  it("never trims the page after the database sized it", async () => {
    // The regression in one assertion: whatever the origin filter is, every row the database returned
    // survives into `items`, so a full page stays a full page and `hasMore` keeps meaning something.
    state.rows = Array.from({ length: 26 }, (_, i) => ({
      id: `p${i}`,
      organization_id: "o1",
      import_sources: i % 2 === 0 ? [{ kind: "zip" }] : []
    }));

    const page = await adminProjects(ACTOR, { origin: "imported" });

    expect(page.items).toHaveLength(25);
    expect(page.hasMore).toBe(true);
  });

  it("reads the origin off the embedded row rather than a second query", async () => {
    state.rows = [
      { id: "p1", organization_id: "o1", import_sources: [{ kind: "repo" }] },
      { id: "p2", organization_id: "o1", import_sources: [] }
    ];

    const page = await adminProjects(ACTOR);

    expect(page.items.map((p) => p.importKind)).toEqual(["repo", null]);
    // The separate import_sources round trip is gone; the embed replaced it.
    expect(callsOn("import_sources", "select")).toHaveLength(0);
  });

  it("hands the pending-reviews filter to Postgres as two conditions", async () => {
    await adminReviews(ACTOR, { pending: true });

    expect(callsOn("project_reviews", "eq")).toContainEqual(["consent_public", true]);
    expect(callsOn("project_reviews", "is")).toContainEqual(["published_at", null]);
  });

  it("returns only a page's worth even when the database hands back the extra row", async () => {
    state.rows = Array.from({ length: 26 }, (_, i) => ({ id: `t${i}`, organization_id: "o1", user_id: "u1" }));

    const page = await adminTickets(ACTOR);

    expect(page.items).toHaveLength(25);
    expect(page.pageSize).toBe(25);
  });

  it("reports another page from the extra row, not from the page being full", async () => {
    state.rows = Array.from({ length: 26 }, (_, i) => ({ id: `t${i}`, organization_id: "o1", user_id: "u1" }));

    expect((await adminTickets(ACTOR)).hasMore).toBe(true);
  });

  it("reports the end of the list when the extra row does not come back", async () => {
    state.rows = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}`, organization_id: "o1", user_id: "u1" }));

    // Exactly a full page and no more: the count alone cannot tell these two cases apart, which is
    // why `hasMore` is decided here and never re-derived by the pager.
    expect((await adminTickets(ACTOR)).hasMore).toBe(false);
  });
});

describe("publishing a review", () => {
  it("refuses one whose author has not consented", async () => {
    state.rows = [{ id: "r1", consent_public: false }];

    await expect(setReviewPublished(ACTOR, "r1", true)).resolves.toEqual({
      ok: false,
      reason: "no-consent"
    });
    // The refusal has to be a refusal to *write*, not merely a returned reason.
    expect(state.updates).toHaveLength(0);
  });

  it("publishes one whose author has consented", async () => {
    state.rows = [{ id: "r1", consent_public: true }];

    await expect(
      setReviewPublished(ACTOR, "r1", true, new Date("2026-07-31T12:00:00.000Z"))
    ).resolves.toEqual({ ok: true });
    expect(state.updates).toEqual([
      { table: "project_reviews", payload: { published_at: "2026-07-31T12:00:00.000Z" } }
    ]);
  });

  it("always allows taking one down, consent or not", async () => {
    // Unpublishing is never blocked: whatever the flags say, removing a public quote is safe.
    state.rows = [{ id: "r1", consent_public: false }];

    await expect(setReviewPublished(ACTOR, "r1", false)).resolves.toEqual({ ok: true });
    expect(state.updates).toEqual([{ table: "project_reviews", payload: { published_at: null } }]);
  });

  it("says so when the review is gone", async () => {
    state.rows = [];
    await expect(setReviewPublished(ACTOR, "r1", true)).resolves.toEqual({
      ok: false,
      reason: "missing"
    });
  });
});

describe("suspending an account (spec 164)", () => {
  const NOW = new Date("2026-08-01T10:17:30.000Z");

  it("writes the one column that enforces it", async () => {
    profileFlags.mockImplementation(async (id: string) =>
      id === ACTOR ? { isAdmin: true, suspendedAt: null } : { isAdmin: false, suspendedAt: null }
    );

    await expect(setUserSuspended(ACTOR, "u1", true, NOW)).resolves.toEqual({ ok: true });
    expect(state.updates).toEqual([
      { table: "profiles", payload: { suspended_at: "2026-08-01T10:17:30.000Z" } }
    ]);
  });

  it("clears it on reactivation, and asks nothing about the target first", async () => {
    // Bringing an account back is never refused — including an admin row that somehow got suspended.
    await expect(setUserSuspended(ACTOR, "u1", false, NOW)).resolves.toEqual({ ok: true });
    expect(state.updates).toEqual([{ table: "profiles", payload: { suspended_at: null } }]);
  });

  it("fails loudly on a database that has no suspended_at", async () => {
    // The failure mode spec 164 exists because of: an operator who is told nothing assumes it worked.
    // PostgREST rejects the write against its own schema cache, and that error must reach the screen
    // rather than being swallowed the way the *read* path deliberately swallows it.
    profileFlags.mockImplementation(async (id: string) =>
      id === ACTOR ? { isAdmin: true, suspendedAt: null } : { isAdmin: false, suspendedAt: null }
    );
    state.errorFor = {
      profiles: {
        code: "PGRST204",
        message: "Could not find the 'suspended_at' column of 'profiles' in the schema cache"
      }
    };

    await expect(setUserSuspended(ACTOR, "u1", true, NOW)).rejects.toThrow(/suspended_at/);
  });

  it("refuses to suspend another operator, and writes nothing", async () => {
    // Both of us are admins; suspending either locks the console and the way back is SQL.
    profileFlags.mockResolvedValue({ isAdmin: true, suspendedAt: null });

    await expect(setUserSuspended(ACTOR, "u2", true, NOW)).resolves.toEqual({
      ok: false,
      reason: "admin"
    });
    expect(state.updates).toEqual([]);
  });
});

describe("Pro that support gives (spec 164)", () => {
  const NOW = new Date("2026-08-01T00:00:00.000Z");

  it("writes a plan_grants row and never touches organizations", async () => {
    // The rule the whole design hangs on: `organizations.plan` is Stripe's, and a write there would be
    // reconciled away by the next webhook without anyone seeing it (specs 74, 99, 100).
    state.rowsFor = { organizations: [{ plan: "free" }], plan_grants: [] };

    await expect(grantSupportPro(ACTOR, "org1", 30, NOW)).resolves.toEqual({
      ok: true,
      expiresAt: "2026-08-31T00:00:00.000Z"
    });
    expect(state.inserts).toEqual([
      {
        table: "plan_grants",
        payload: {
          organization_id: "org1",
          source: "support",
          duration_days: 30,
          starts_at: "2026-08-01T00:00:00.000Z",
          expires_at: "2026-08-31T00:00:00.000Z"
        }
      }
    ]);
    expect(state.updates.filter((u) => u.table === "organizations")).toEqual([]);
  });

  it("starts the window immediately, unlike an earned week", async () => {
    // A referral week is written unstarted and waits behind any subscription. Support is answering
    // someone who is on the phone now.
    state.rowsFor = { organizations: [{ plan: "free" }], plan_grants: [] };

    await grantSupportPro(ACTOR, "org1", 365, NOW);
    expect(state.inserts[0]?.payload).toMatchObject({ starts_at: "2026-08-01T00:00:00.000Z" });
  });

  it("refuses a workspace that already pays Stripe", async () => {
    state.rowsFor = { organizations: [{ plan: "pro" }], plan_grants: [] };

    await expect(grantSupportPro(ACTOR, "org1", 30, NOW)).resolves.toEqual({
      ok: false,
      reason: "already-pro"
    });
    expect(state.inserts).toEqual([]);
  });

  it("refuses to stack a second grant on a running one", async () => {
    state.rowsFor = {
      organizations: [{ plan: "free" }],
      plan_grants: [
        {
          organization_id: "org1",
          source: "referral",
          starts_at: "2026-07-30T00:00:00.000Z",
          expires_at: "2026-08-06T00:00:00.000Z"
        }
      ]
    };

    await expect(grantSupportPro(ACTOR, "org1", 30, NOW)).resolves.toEqual({
      ok: false,
      reason: "already-granted"
    });
    expect(state.inserts).toEqual([]);
  });

  it("ignores an expired grant when deciding whether one is running", async () => {
    state.rowsFor = {
      organizations: [{ plan: "free" }],
      plan_grants: [
        {
          organization_id: "org1",
          source: "support",
          starts_at: "2026-06-01T00:00:00.000Z",
          expires_at: "2026-07-01T00:00:00.000Z"
        }
      ]
    };

    await expect(grantSupportPro(ACTOR, "org1", 30, NOW)).resolves.toMatchObject({ ok: true });
  });
});

describe("taking Pro back (spec 164)", () => {
  const NOW = new Date("2026-08-01T00:00:00.000Z");

  it("closes the window instead of deleting the row", async () => {
    // `plan_grants` is the record of what we gave and when. A deleted row takes the reason for a
    // founder's lost Pro with it.
    state.rowsFor = {
      plan_grants: [
        {
          id: "g1",
          organization_id: "org1",
          source: "support",
          starts_at: "2026-07-01T00:00:00.000Z",
          expires_at: "2026-09-01T00:00:00.000Z"
        }
      ]
    };

    await expect(revokeActiveGrant(ACTOR, "org1", NOW)).resolves.toEqual({ ok: true });
    expect(state.updates).toEqual([
      { table: "plan_grants", payload: { expires_at: "2026-08-01T00:00:00.000Z" } }
    ]);
    expect(firstCall("plan_grants", "in")).toEqual(["id", ["g1"]]);
  });

  it("ends an earned week too — the button says remove Pro, so Pro is removed", async () => {
    state.rowsFor = {
      plan_grants: [
        {
          id: "g1",
          organization_id: "org1",
          source: "referral",
          starts_at: "2026-07-01T00:00:00.000Z",
          expires_at: "2026-09-01T00:00:00.000Z"
        }
      ]
    };

    await expect(revokeActiveGrant(ACTOR, "org1", NOW)).resolves.toEqual({ ok: true });
  });

  it("says so when there is nothing running, and writes nothing", async () => {
    state.rowsFor = { plan_grants: [] };

    await expect(revokeActiveGrant(ACTOR, "org1", NOW)).resolves.toEqual({
      ok: false,
      reason: "none-active"
    });
    expect(state.updates).toEqual([]);
  });
});

describe("the files we delivered (spec 164)", () => {
  const AIRROW = [{ path: "README.md", content: "# Hello", bytes: 7 }];

  it("reads the newest completed job, never a failed one", async () => {
    state.rowsFor = { generation_jobs: [{ id: "job2", finished_at: "2026-08-01T00:00:00.000Z" }] };

    const found = await adminProjectFiles(
      ACTOR,
      "proj1",
      null,
      async () => AIRROW,
      async () => []
    );
    expect(found).toMatchObject({ jobId: "job2", generatedAt: "2026-08-01T00:00:00.000Z" });
    expect(callsOn("generation_jobs", "eq")).toContainEqual(["project_id", "proj1"]);
    expect(callsOn("generation_jobs", "eq")).toContainEqual(["status", "completed"]);
  });

  it("says nothing was delivered when no generation has completed", async () => {
    state.rowsFor = { generation_jobs: [] };

    await expect(
      adminProjectFiles(ACTOR, "proj1", null, async () => AIRROW, async () => [])
    ).resolves.toBeNull();
  });

  it("lists the founder's own files as paths, and refuses to open one", async () => {
    // We never stored their content — `import_files` holds a path, a size and a digest (spec 75).
    state.rowsFor = { generation_jobs: [{ id: "job1", finished_at: null }] };

    const found = await adminProjectFiles(
      ACTOR,
      "proj1",
      "src/theirs.ts",
      async () => AIRROW,
      async () => [{ path: "src/theirs.ts", bytes: 400 }]
    );

    expect(found?.files).toEqual([
      { path: "README.md", bytes: 7, origin: "airrow" },
      { path: "src/theirs.ts", bytes: 400, origin: "yours" }
    ]);
    expect(found?.opened).toBeNull();
  });

  it("opens only a path it actually generated", async () => {
    state.rowsFor = { generation_jobs: [{ id: "job1", finished_at: null }] };

    const opened = await adminProjectFiles(
      ACTOR,
      "proj1",
      "README.md",
      async () => AIRROW,
      async () => []
    );
    expect(opened?.opened).toEqual({ path: "README.md", content: "# Hello" });

    const invented = await adminProjectFiles(
      ACTOR,
      "proj1",
      "../../etc/passwd",
      async () => AIRROW,
      async () => []
    );
    expect(invented?.opened).toBeNull();
  });
});
