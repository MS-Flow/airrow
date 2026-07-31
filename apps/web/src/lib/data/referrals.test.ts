// The rules a week of Pro is earned and spent by (spec 122).
//
// Asserted against an in-memory stand-in for PostgREST rather than a real database, because what is
// interesting here is the arithmetic — the cap, the queue, the window — and none of it should need a
// container to prove. The schema's own guarantees (RLS, the unique constraint that makes attachment
// idempotent, the self-referral check) are asserted in `referrals.db.test.ts`, against real Postgres,
// because those are Postgres's promises and not this file's.
import { beforeEach, describe, expect, it, vi } from "vitest";

interface Row {
  [column: string]: string | number | null;
}

const tables: {
  referral_codes: Row[];
  referrals: Row[];
  plan_grants: Row[];
  // Read, never written, and only to put a name on an invitation (spec 133).
  organizations: Row[];
  organization_members: Row[];
  profiles: Row[];
} = {
  referral_codes: [],
  referrals: [],
  plan_grants: [],
  organizations: [],
  organization_members: [],
  profiles: []
};

/** Every table a query touched, so "does not look up names for an empty list" is assertable. */
const queried: string[] = [];

/** The table, or a loud failure — a harness that invents a table is a harness that proves nothing. */
function tableRows(name: string): Row[] {
  // Cast rather than a lookup type: the query builder is handed a string, and the check below is
  // exactly what turns it back into one of the tables this module uses.
  const found = (tables as Record<string, Row[] | undefined>)[name];
  if (!found) throw new Error(`Unexpected table: ${name}`);
  return found;
}

let nextId = 0;

/** Answer every query the way PostgREST does when the migration has not been applied. */
let missingTables = false;
/** Or with some other fault entirely, to prove the tolerance above is not a blanket catch. */
let brokenWith: { message: string; code?: string } | null = null;

const countGenerations = vi.hoisted(() => vi.fn(async () => 1));

vi.mock("./store", () => ({ countGenerations }));

/**
 * Enough of the query builder to run this module: the filters it uses (`eq`, `is`, `not`), `order`,
 * and inserts and updates that return what they wrote. Anything else throws rather than quietly
 * answering — a test harness that invents results is worse than no harness.
 */
const dbMock = vi.hoisted(() => ({
  from(table: string) {
    queried.push(table);
    return makeChain(table);
  }
}));

vi.mock("./supabase", async () => {
  const actual = await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, db: vi.fn(() => dbMock) };
});

type Filter = (row: Row) => boolean;

function makeChain(table: string) {
  const filters: Filter[] = [];
  let pending: Row[] | null = null;
  let updateValues: Row | null = null;
  let projection: string[] = [];
  let orderBy: string | null = null;

  /** What PostgREST answers with instead of rows, when it answers with a fault. */
  const fault = (): { message: string; code?: string } | null => {
    if (brokenWith) return brokenWith;
    if (missingTables) {
      return {
        message: `Could not find the table 'public.${table}' in the schema cache`,
        code: "PGRST205"
      };
    }
    return null;
  };

  const rowsFor = (): Row[] => {
    // Filters are applied here rather than when `update` is called: PostgREST builds the whole
    // statement before sending it, and a mock that applied an update the moment it was described
    // would write to every row in the table — which is exactly the bug this comment replaces.
    const matched = tableRows(table).filter((row) => filters.every((f) => f(row)));
    if (updateValues) {
      for (const row of matched) Object.assign(row, updateValues);
      pending = matched;
    }
    const base = pending ?? matched;
    const key = orderBy;
    const sorted = key
      ? [...base].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? "")))
      : base;
    if (projection.length === 0) return sorted;
    return sorted.map((row) => {
      const picked: Row = {};
      for (const column of projection) picked[column] = row[column] ?? null;
      return picked;
    });
  };

  const chain = {
    select(value: string) {
      projection = value.split(",").map((c) => c.trim());
      return chain;
    },
    eq(column: string, value: string) {
      filters.push((row) => row[column] === value);
      return chain;
    },
    is(column: string, value: null) {
      filters.push((row) => (row[column] ?? null) === value);
      return chain;
    },
    not(column: string, _op: string, _value: null) {
      filters.push((row) => (row[column] ?? null) !== null);
      return chain;
    },
    in(column: string, values: string[]) {
      filters.push((row) => values.includes(String(row[column])));
      return chain;
    },
    order(column: string) {
      orderBy = column;
      return chain;
    },
    insert(values: Row) {
      // Columns the schema defaults are spelled out, so a row here looks like the row Postgres
      // would hold rather than only the fields this code happened to set.
      const row: Row = { id: `row-${++nextId}`, starts_at: null, expires_at: null, ...values };
      tableRows(table).push(row);
      pending = [row];
      return chain;
    },
    update(values: Row) {
      updateValues = values;
      return chain;
    },
    single() {
      const error = fault();
      if (error) return Promise.resolve({ data: null, error });
      const found = rowsFor()[0];
      return Promise.resolve(found ? { data: found, error: null } : { data: null, error: null });
    },
    maybeSingle() {
      const error = fault();
      if (error) return Promise.resolve({ data: null, error });
      return Promise.resolve({ data: rowsFor()[0] ?? null, error: null });
    },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      const error = fault();
      const result = error ? { data: null, error } : { data: rowsFor(), error: null };
      return Promise.resolve(result).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

const {
  REFERRAL_CAP,
  REFERRAL_GRANT_DAYS,
  UNNAMED_INVITE,
  attachReferral,
  claimPro,
  grantStanding,
  matureReferral,
  referralSummary
} = await import("./referrals");

/** Anchored in UTC so the window arithmetic reads the same everywhere (§V). */
const NOW = new Date("2026-08-01T09:00:00.000Z");
const daysAfterNow = (days: number): Date =>
  new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000);

const INVITER = "org-inviter";
const INVITED = "org-invited";

function seedReferral(referred: string, matured = false): void {
  tables.referrals.push({
    id: `ref-${referred}`,
    referrer_organization_id: INVITER,
    referred_organization_id: referred,
    attached_at: "2026-07-30T00:00:00.000Z",
    matured_at: matured ? "2026-07-31T00:00:00.000Z" : null,
    plan_grant_id: null
  });
}

beforeEach(() => {
  tables.referral_codes = [];
  tables.referrals = [];
  tables.plan_grants = [];
  tables.organizations = [];
  tables.organization_members = [];
  tables.profiles = [];
  queried.length = 0;
  nextId = 0;
  missingTables = false;
  brokenWith = null;
  countGenerations.mockResolvedValue(1);
});

describe("earning a week", () => {
  it("credits the inviter when the invited workspace generates", async () => {
    seedReferral(INVITED);

    await matureReferral(INVITED, NOW);

    expect(tables.plan_grants).toHaveLength(1);
    expect(tables.plan_grants[0]).toMatchObject({
      organization_id: INVITER,
      duration_days: REFERRAL_GRANT_DAYS,
      // Queued, not running: the week starts when it is needed, not when it is earned.
      starts_at: null
    });
    expect(tables.referrals[0]?.matured_at).toBe(NOW.toISOString());
  });

  it("credits nothing for a second generation by the same workspace", async () => {
    seedReferral(INVITED);

    await matureReferral(INVITED, NOW);
    await matureReferral(INVITED, daysAfterNow(1));

    expect(tables.plan_grants).toHaveLength(1);
  });

  it("credits nothing when the generation was never charged for", async () => {
    // A job that failed on our side, or one that reused a previous payload: the ledger says nobody
    // paid for a Claude call, so nobody earned a week either.
    seedReferral(INVITED);
    countGenerations.mockResolvedValue(0);

    await matureReferral(INVITED, NOW);

    expect(tables.plan_grants).toHaveLength(0);
    expect(tables.referrals[0]?.matured_at).toBeNull();
  });

  it("records the referral but credits no week past the cap", async () => {
    for (let i = 0; i < REFERRAL_CAP; i++) {
      tables.referrals.push({
        id: `spent-${i}`,
        referrer_organization_id: INVITER,
        referred_organization_id: `org-${i}`,
        attached_at: "2026-07-01T00:00:00.000Z",
        matured_at: "2026-07-02T00:00:00.000Z",
        plan_grant_id: `grant-${i}`
      });
    }
    seedReferral(INVITED);

    await matureReferral(INVITED, NOW);

    expect(tables.plan_grants).toHaveLength(0);
    const overflow = tables.referrals.find((r) => r.referred_organization_id === INVITED);
    // Matured, and visibly uncredited — the cap is auditable rather than inferred from an absence.
    expect(overflow?.matured_at).toBe(NOW.toISOString());
    expect(overflow?.plan_grant_id).toBeNull();
  });
});

describe("spending a week", () => {
  function queueGrant(created: string): void {
    tables.plan_grants.push({
      id: `grant-${created}`,
      organization_id: INVITER,
      source: "referral",
      duration_days: REFERRAL_GRANT_DAYS,
      starts_at: null,
      expires_at: null,
      created_at: created
    });
  }

  it("starts a queued week the first time it is claimed", async () => {
    queueGrant("2026-07-30T00:00:00.000Z");

    const until = await claimPro(INVITER, NOW);

    expect(until).toBe(daysAfterNow(REFERRAL_GRANT_DAYS).toISOString());
    expect(tables.plan_grants[0]?.starts_at).toBe(NOW.toISOString());
  });

  it("does not start a second week while one is running", async () => {
    queueGrant("2026-07-30T00:00:00.000Z");
    queueGrant("2026-07-31T00:00:00.000Z");

    const first = await claimPro(INVITER, NOW);
    const second = await claimPro(INVITER, daysAfterNow(1));

    expect(second).toBe(first);
    expect(tables.plan_grants.filter((g) => g.starts_at !== null)).toHaveLength(1);
  });

  it("is not Pro once the week has run out, and starts the next one", async () => {
    queueGrant("2026-07-30T00:00:00.000Z");
    queueGrant("2026-07-31T00:00:00.000Z");

    await claimPro(INVITER, NOW);
    const later = daysAfterNow(REFERRAL_GRANT_DAYS + 1);

    expect((await grantStanding(INVITER, later)).activeUntil).toBeNull();
    expect(await claimPro(INVITER, later)).toBe(
      new Date(later.getTime() + REFERRAL_GRANT_DAYS * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("reports without starting anything", async () => {
    queueGrant("2026-07-30T00:00:00.000Z");

    const standing = await grantStanding(INVITER, NOW);

    expect(standing).toEqual({ activeUntil: null, queued: 1 });
    expect(tables.plan_grants[0]?.starts_at).toBeNull();
  });

  it("has nothing to claim when nothing was earned", async () => {
    expect(await claimPro(INVITER, NOW)).toBeNull();
  });
});

describe("the invite card's summary", () => {
  it("counts places by weeks credited, not by invitations sent", async () => {
    seedReferral("org-joined");
    tables.referrals.push({
      id: "ref-credited",
      referrer_organization_id: INVITER,
      referred_organization_id: "org-generated",
      attached_at: "2026-07-29T00:00:00.000Z",
      matured_at: "2026-07-30T00:00:00.000Z",
      plan_grant_id: "grant-1"
    });

    const summary = await referralSummary(INVITER, NOW);

    expect(summary?.credited).toBe(1);
    expect(summary?.remaining).toBe(REFERRAL_CAP - 1);
    expect(summary?.invites.map((i) => i.state)).toEqual(["generated", "joined"]);
    expect(summary?.code).toHaveLength(14);
  });
});

/* ── Who each invitation is about (spec 133) ───────────────────────────────
 *
 * Three identical rows saying "Generated their foundation" tell the person who sent the links nothing.
 * The name is read at render time rather than copied onto the referral, so rows written before this
 * existed get names too — which is the case the last test here stands for.
 */
describe("naming an invitation", () => {
  function invited(
    orgId: string,
    { workspace, display }: { workspace?: string; display?: string } = {}
  ): void {
    tables.referrals.push({
      id: `ref-${orgId}`,
      referrer_organization_id: INVITER,
      referred_organization_id: orgId,
      attached_at: "2026-07-30T00:00:00.000Z",
      matured_at: null,
      plan_grant_id: null
    });
    if (workspace !== undefined) tables.organizations.push({ id: orgId, name: workspace });
    if (display !== undefined) {
      tables.organization_members.push({ organization_id: orgId, user_id: `user-${orgId}` });
      tables.profiles.push({ id: `user-${orgId}`, display_name: display });
    }
  }

  it("uses the account's own name", async () => {
    invited(INVITED, { workspace: "Ada's workspace", display: "Ada Lovelace" });

    const summary = await referralSummary(INVITER, NOW);

    expect(summary?.invites[0]?.name).toBe("Ada Lovelace");
  });

  it("falls back to the workspace name when there is no profile", async () => {
    invited(INVITED, { workspace: "Ada's workspace" });

    const summary = await referralSummary(INVITER, NOW);

    expect(summary?.invites[0]?.name).toBe("Ada's workspace");
  });

  it("falls back to the workspace name when the profile has no display name", async () => {
    invited(INVITED, { workspace: "Ada's workspace", display: "" });

    const summary = await referralSummary(INVITER, NOW);

    expect(summary?.invites[0]?.name).toBe("Ada's workspace");
  });

  it("says something neutral rather than leaving a gap", async () => {
    invited(INVITED);

    const summary = await referralSummary(INVITER, NOW);

    expect(summary?.invites[0]?.name).toBe(UNNAMED_INVITE);
  });

  it("names each invitation separately", async () => {
    invited("org-a", { display: "Ada" });
    invited("org-b", { display: "Grace" });

    const summary = await referralSummary(INVITER, NOW);

    expect(summary?.invites.map((i) => i.name)).toEqual(["Ada", "Grace"]);
  });

  it("looks up no names at all for a card with no invitations", async () => {
    await referralSummary(INVITER, NOW);

    expect(queried).not.toContain("organizations");
    expect(queried).not.toContain("profiles");
  });
});

/* ── A database behind its migrations ──────────────────────────────────────
 *
 * The regression this exists for was real and immediate: a dev server pointed at a project that had
 * not run the referrals migration answered `Could not find the table 'public.plan_grants' in the
 * schema cache`, and Settings died on it — as would the projects list, the interview screen, the
 * import screen and the delivery screen, because all five read referrals now.
 *
 * `store.ts` already learned this lesson at column granularity (`isMissingColumn`). These are the same
 * lesson at table granularity: a missing feature reads as "nobody has any invitations", never as a
 * failure, because the screens that would break are the ones whose only job is to tell a founder where
 * they stand.
 */
describe("when the tables do not exist yet", () => {
  beforeEach(() => {
    missingTables = true;
  });

  it("reports no earned weeks instead of throwing", async () => {
    await expect(grantStanding(INVITER, NOW)).resolves.toEqual({ activeUntil: null, queued: 0 });
  });

  it("grants nothing, so the free ceiling still applies", async () => {
    await expect(claimPro(INVITER, NOW)).resolves.toBeNull();
  });

  it("has no summary to show, rather than a broken page", async () => {
    await expect(referralSummary(INVITER, NOW)).resolves.toBeNull();
  });

  it("attaches nothing, and does not break the signup asking", async () => {
    await expect(attachReferral("some-code", INVITED)).resolves.toBe(false);
  });

  it("credits nothing, and does not fail the generation that finished", async () => {
    await expect(matureReferral(INVITED, NOW)).resolves.toBeUndefined();
  });

  it("still throws on an error that is not a missing table", async () => {
    // The tolerance is narrow on purpose: a real fault must not be read as "no invitations".
    missingTables = false;
    brokenWith = { message: "connection reset", code: "08006" };

    await expect(grantStanding(INVITER, NOW)).rejects.toThrow(/connection reset/);
  });
});
