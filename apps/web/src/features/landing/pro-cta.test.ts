// The pricing section's Pro action sent everyone to the new-project form, including the founder who
// had just spent their free foundation — pressing "Start with Pro" and being handed the one screen
// that cannot sell them Pro. The signed-out case had the same shape (the guest interview) until
// amendment 2 of spec 179. These cases are the whole rule.
import { describe, it, expect } from "vitest";
import type { Entitlement } from "@/features/generation/allowance";
import { GUEST_INTERVIEW_PATH } from "@/features/interview/guest-route";
import { NEW_PROJECT_PATH, SIGNUP_PATH, UPGRADE_PATH, proCtaHref } from "./pro-cta";

const untouched: Entitlement = {
  allowed: true,
  plan: "free",
  grant: "free",
  used: 0,
  remaining: 1,
  unlimited: false
};

const spent: Entitlement = {
  allowed: false,
  plan: "free",
  denial: "free-spent",
  used: 1,
  remaining: 0,
  unlimited: false
};

const pro: Entitlement = {
  allowed: true,
  plan: "pro",
  grant: "pro",
  used: 4,
  remaining: Number.POSITIVE_INFINITY,
  unlimited: true
};

describe("proCtaHref", () => {
  it("asks a signed-out visitor for an account, which is what Pro actually needs", () => {
    expect(proCtaHref(null)).toBe(SIGNUP_PATH);
  });

  it("never sends a signed-out visitor into the guest interview from the Pro card", () => {
    // The regression this replaces: pressing a priced card started a free foundation instead.
    expect(proCtaHref(null)).not.toBe(GUEST_INTERVIEW_PATH);
  });

  it("sends a founder with nothing generated to their free foundation", () => {
    expect(proCtaHref(untouched)).toBe(NEW_PROJECT_PATH);
  });

  it("sends a founder who has spent the free foundation straight to the upgrade screen", () => {
    expect(proCtaHref(spent)).toBe(UPGRADE_PATH);
  });

  it("sends an existing Pro founder to the upgrade screen, where billing is managed", () => {
    // Not a dead end: that screen recognises an organization already on Pro and offers the portal.
    expect(proCtaHref(pro)).toBe(UPGRADE_PATH);
  });
});
