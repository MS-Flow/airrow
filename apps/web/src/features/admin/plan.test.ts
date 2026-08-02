// What the plan line says (spec 164).
//
// Every case here was previously invisible: the console rendered `Stripe: <status>` and the two facts
// support actually needs — when it ends, and whether they cancelled — were read out of the database and
// thrown away. These are the cases that have to keep reading right, and none of them needs a database
// to check, which is the whole reason the logic is a pure function.
import { describe, it, expect } from "vitest";
import { grantWouldApply, planLabel, planSourceLabel, planStanding } from "./plan";
import type { ActiveGrant, AdminSubscription } from "@/lib/data/admin";

const PERIOD_END = "2026-09-12T00:00:00.000Z";

function subscription(over: Partial<AdminSubscription> = {}): AdminSubscription {
  return { status: "active", currentPeriodEnd: PERIOD_END, cancelAtPeriodEnd: false, ...over };
}

function grant(over: Partial<ActiveGrant> = {}): ActiveGrant {
  return { organizationId: "org1", source: "referral", expiresAt: PERIOD_END, ...over };
}

describe("planStanding", () => {
  it("reads a paying workspace as Pro, with the date it renews", () => {
    expect(planStanding({ plan: "pro", subscription: subscription(), grant: null })).toEqual({
      kind: "pro",
      source: "bought",
      until: PERIOD_END
    });
  });

  it("separates a cancellation from a renewal", () => {
    // The whole reason `cancel_at_period_end` had to stop being discarded: both of these are `active`
    // at Stripe, and telling a founder their subscription renews on the day it ends is the failure.
    const standing = planStanding({
      plan: "pro",
      subscription: subscription({ cancelAtPeriodEnd: true }),
      grant: null
    });

    expect(standing).toEqual({ kind: "pro-cancelling", source: "bought", until: PERIOD_END });
    expect(planLabel(standing)).toBe("Pro · cancelled");
  });

  it("reads a paused subscription as paused rather than renewing", () => {
    // Stripe reports pause_collection as `active` throughout; `toSubscriptionState` already renames it.
    expect(
      planStanding({ plan: "pro", subscription: subscription({ status: "paused" }), grant: null })
    ).toEqual({ kind: "pro-paused", until: PERIOD_END });
  });

  it("shows Pro with no date when Stripe gives no period", () => {
    expect(
      planStanding({ plan: "pro", subscription: subscription({ currentPeriodEnd: null }), grant: null })
    ).toEqual({ kind: "pro", source: "bought", until: null });
  });

  it("names an earned week and the day it ends", () => {
    const standing = planStanding({ plan: "free", subscription: null, grant: grant() });

    expect(standing).toEqual({ kind: "pro", source: "earned", until: PERIOD_END });
    expect(planSourceLabel(standing)).toBe("earned by inviting someone");
  });

  it("names Pro we granted, so nobody goes looking for a subscription to cancel", () => {
    const standing = planStanding({
      plan: "free",
      subscription: null,
      grant: grant({ source: "support" })
    });

    expect(planSourceLabel(standing)).toBe("granted by support");
  });

  it("lets the paid plan win over a grant, exactly as claimPro does", () => {
    // A grant behind a subscription is unspent, not additive. Reporting it here would promise an
    // entitlement the product resolves differently.
    const standing = planStanding({
      plan: "pro",
      subscription: subscription(),
      grant: grant({ source: "support" })
    });

    expect(standing).toMatchObject({ source: "bought" });
  });

  it("reads a lapsed subscription as lapsed, with the day it ended", () => {
    expect(
      planStanding({ plan: "free", subscription: subscription({ status: "canceled" }), grant: null })
    ).toEqual({ kind: "lapsed", status: "canceled", since: PERIOD_END });
  });

  it("keeps an unfinished payment attempt apart from a subscription that ran and stopped", () => {
    // `incomplete` is a checkout nobody completed. Calling it "lapsed" would send support looking for
    // a refund that never happened.
    expect(
      planStanding({ plan: "free", subscription: subscription({ status: "incomplete" }), grant: null })
    ).toEqual({ kind: "free-attempted", status: "incomplete" });
  });

  it("says free when there is nothing at all", () => {
    expect(planStanding({ plan: "free", subscription: null, grant: null })).toEqual({ kind: "free" });
  });
});

describe("grantWouldApply", () => {
  it("is false while a paid plan is covering the workspace", () => {
    expect(grantWouldApply(planStanding({ plan: "pro", subscription: subscription(), grant: null }))).toBe(
      false
    );
  });

  it("is false while another grant is already running", () => {
    expect(grantWouldApply(planStanding({ plan: "free", subscription: null, grant: grant() }))).toBe(false);
  });

  it("is true for a free workspace, and for one whose subscription lapsed", () => {
    expect(grantWouldApply(planStanding({ plan: "free", subscription: null, grant: null }))).toBe(true);
    expect(
      grantWouldApply(
        planStanding({ plan: "free", subscription: subscription({ status: "canceled" }), grant: null })
      )
    ).toBe(true);
  });
});
