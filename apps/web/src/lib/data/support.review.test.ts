// Withdrawing consent takes a published review down (spec 150).
//
// Spec 144 promised that nothing in the app writes `published_at`. Spec 150 narrowed that promise by
// direction rather than breaking it: the admin console is the only thing that ever *sets* it, and this
// is the only thing that ever clears it. A public quote left standing after its author took permission
// back is the failure that actually matters, so it must not wait for an operator to notice.
//
// Tested on the upsert payload, which is where the rule lives — the column's behaviour itself is
// covered against real Postgres in `support.db.test.ts`.
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({ upserts: [] as Record<string, unknown>[], existing: [] as unknown[] }));

const db = vi.hoisted(() => () => {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  for (const method of ["select", "eq", "order", "limit", "is"]) builder[method] = chain;
  builder.upsert = (payload: Record<string, unknown>) => {
    state.upserts.push(payload);
    return builder;
  };
  builder.single = () => ({
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      resolve({
        data: {
          id: "rev1",
          project_id: "p1",
          rating: 5,
          body: "",
          consent_public: false,
          display_name: "A",
          created_at: "2026-07-01",
          updated_at: "2026-07-31"
        },
        error: null
      })
  });
  builder.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
    resolve({ data: state.existing, error: null });
  return { from: () => builder };
});

vi.mock("./supabase", async () => {
  const actual = await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, db };
});

import { saveReview } from "./support";

const input = {
  orgId: "org1",
  projectId: "p1",
  userId: "u1",
  rating: 5,
  body: "Good",
  displayName: "A Founder"
};

beforeEach(() => {
  state.upserts = [];
  state.existing = [];
});

describe("saveReview and consent", () => {
  it("clears published_at when the founder withdraws consent", async () => {
    await saveReview({ ...input, consentPublic: false });

    expect(state.upserts[0]).toMatchObject({ consent_public: false, published_at: null });
  });

  it("leaves published_at alone when consent stands", async () => {
    // Writing `published_at` here in *either* direction would make this module a publisher, which is
    // the console's job alone. Absent from the payload means the stored value survives the upsert.
    await saveReview({ ...input, consentPublic: true });

    expect(state.upserts[0]).toMatchObject({ consent_public: true });
    expect(state.upserts[0]).not.toHaveProperty("published_at");
  });

  it("never sets published_at to anything but null", async () => {
    for (const consentPublic of [true, false]) {
      state.upserts = [];
      await saveReview({ ...input, consentPublic });
      const written = state.upserts[0]?.published_at;
      expect(written === undefined || written === null).toBe(true);
    }
  });
});
