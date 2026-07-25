import { describe, it, expect } from "vitest";
import { NAV_ITEMS } from "./nav-items";

/**
 * The sidebar and the ⌘K palette both build themselves from this list, so a screen that
 * doesn't exist can only reappear in the UI by reappearing here (spec 11, F5).
 */
describe("NAV_ITEMS", () => {
  it("lists only screens that exist", () => {
    expect(NAV_ITEMS.map((n) => n.href)).toEqual(["/app", "/app/settings"]);
  });

  it("has no entry for the removed Templates and Prompts screens", () => {
    const labels = NAV_ITEMS.map((n) => n.label);
    expect(labels).not.toContain("Templates");
    expect(labels).not.toContain("Prompts");
  });
});
