// The pricing section's Pro action sent everyone to the new-project form, including the founder who
// had just spent their free foundation — pressing "Start with Pro" and being handed the one screen
// that cannot sell them Pro. These four cases are the whole rule.
import { describe, it, expect } from "vitest";
import type { Entitlement } from "@/features/generation/allowance";
import { GUEST_INTERVIEW_PATH } from "@/features/interview/guest-route";
import { NEW_PROJECT_PATH, UPGRADE_PATH, proCtaHref } from "./pro-cta";

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
  it("sends a signed-out visitor to the interview, which is the only thing they can do", () => {
    expect(proCtaHref(null)).toBe(GUEST_INTERVIEW_PATH);
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
