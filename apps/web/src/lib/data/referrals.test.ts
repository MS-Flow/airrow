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

const tables: { referral_codes: Row[]; referrals: Row[]; plan_grants: Row[] } = {
  referral_codes: [],
  referrals: [],
  plan_grants: []
};

/** The table, or a loud failure — a harness that invents a table is a harness that proves nothing. */
function tableRows(name: string): Row[] {
  // Cast rather than a lookup type: the query builder is handed a string, and the check below is
  // exactly what turns it back into one of the three tables this module uses.
  const found = (tables as Record<string, Row[] | undefined>)[name];
  if (!found) throw new Error(`Unexpected table: ${name}`);
  return found;
}

let nextId = 0;
const countGenerations = vi.hoisted(() => vi.fn(async () => 1));

vi.mock("./store", () => ({ countGenerations }));

/**
 * Enough of the query builder to run this module: the filters it uses (`eq`, `is`, `not`), `order`,
 * and inserts and updates that return what they wrote. Anything else throws rather than quietly
 * answering — a test harness that invents results is worse than no harness.
 */
const dbMock = vi.hoisted(() => ({
  from(table: string) {
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
      const found = rowsFor()[0];
      return Promise.resolve(found ? { data: found, error: null } : { data: null, error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data: rowsFor()[0] ?? null, error: null });
    },
    then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
      return Promise.resolve({ data: rowsFor(), error: null }).then(onFulfilled, onRejected);
    }
  };
  return chain;
}

const {
  REFERRAL_CAP,
  REFERRAL_GRANT_DAYS,
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
  nextId = 0;
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

    expect(summary.credited).toBe(1);
    expect(summary.remaining).toBe(REFERRAL_CAP - 1);
    expect(summary.invites.map((i) => i.state)).toEqual(["generated", "joined"]);
    expect(summary.code).toHaveLength(14);
  });
});
