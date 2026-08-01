import { describe, it, expect } from "vitest";
import { navItems } from "./nav-items";

/**
 * The sidebar and the ⌘K palette both build themselves from this list, so a screen that
 * doesn't exist can only reappear in the UI by reappearing here (spec 11, F5).
 *
 * Since spec 150 the list depends on who is asking, which makes the admin entry's absence for
 * everybody else worth asserting rather than assuming — the sidebar and the palette are fed from one
 * call, so a leak here would leak into both at once.
 */
describe("navItems", () => {
  it("lists only screens that exist", () => {
    expect(navItems({ isAdmin: false }).map((n) => n.href)).toEqual([
      "/app",
      "/app/settings",
      "/app/support"
    ]);
  });

  it("has no entry for the removed Templates and Prompts screens", () => {
    const labels = navItems({ isAdmin: false }).map((n) => n.label);
    expect(labels).not.toContain("Templates");
    expect(labels).not.toContain("Prompts");
  });

  it("hides the admin console from everyone who does not operate Airrow", () => {
    const items = navItems({ isAdmin: false });
    expect(items.map((n) => n.href)).not.toContain("/app/admin");
    expect(items.map((n) => n.label)).not.toContain("Admin");
  });

  it("appends the admin console for an operator, without disturbing the rest", () => {
    const items = navItems({ isAdmin: true });
    expect(items.map((n) => n.href)).toEqual([
      "/app",
      "/app/settings",
      "/app/support",
      "/app/admin"
    ]);
  });

  it("does not let one caller's list mutate the next one's", () => {
    // The admin list is built with a spread rather than a push for exactly this reason: the base
    // array is module state, and a caller that appended to it in place would give the *next*
    // non-admin an Admin link.
    navItems({ isAdmin: true });
    expect(navItems({ isAdmin: false }).map((n) => n.href)).not.toContain("/app/admin");
  });
});
