import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom implements no scrolling at all, so a component that scrolls its own container throws.
// Only the component tests get a DOM — the data-layer ones run on node, where there is no Element.
if (typeof Element !== "undefined") {
  Element.prototype.scrollTo = function scrollTo() {};
}

// Nor does it implement ResizeObserver, which Radix measures its controls with. Nothing here asserts
// on a measurement — a stub that never reports is enough to let the components mount.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  cleanup();
});
