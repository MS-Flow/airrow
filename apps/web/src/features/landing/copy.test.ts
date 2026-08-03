import { describe, it, expect } from "vitest";
import * as copy from "./copy";
import { FOOTER_LINKS } from "@/components/shell/footer-links";

/**
 * The landing page renders nothing but these strings, so the voice can be checked here
 * once instead of read out of JSX (spec 23): no single AI tool is named, and no sentence
 * leans on the em dash that marks copy as machine-written.
 */
function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const LANDING_STRINGS = [...strings(copy), ...FOOTER_LINKS.map((l) => l.label)];

describe("landing copy", () => {
  it("has strings to check", () => {
    expect(LANDING_STRINGS.length).toBeGreaterThan(30);
  });

  it("names no single AI assistant", () => {
    // CLAUDE.md is a real filename in the output and stays; the product name does not.
    const offenders = LANDING_STRINGS.filter((s) => /claude code/i.test(s));
    expect(offenders).toEqual([]);
  });

  it("uses no em dash or double hyphen", () => {
    const offenders = LANDING_STRINGS.filter((s) => s.includes("—") || s.includes("--"));
    expect(offenders).toEqual([]);
  });

  // Spec 100. Pro became purchasable in spec 99 while this page still badged it "Coming soon" — the
  // one screen whose entire job is to be believed, saying something untrue about the product. The
  // copy is what drifts; a test on the copy is what notices.
  it("does not describe Pro as unavailable, because it is not", () => {
    const offenders = LANDING_STRINGS.filter((s) =>
      /coming soon|not available|isn't purchasable|unavailable/i.test(s)
    );
    expect(offenders).toEqual([]);
  });

  // The same lie in the future tense. "Pro lifts the limit when it lands" passed the check above
  // untouched, so the check above was not the check that was needed.
  it("does not promise Pro as something still to arrive", () => {
    const offenders = LANDING_STRINGS.filter((s) =>
      /when it lands|when it ships|will be available|launching soon/i.test(s)
    );
    expect(offenders).toEqual([]);
  });

  it("names no price, because the amount lives in Stripe", () => {
    // Spec 99 keeps every figure in the dashboard so it changes without a deploy. A number here
    // would be a second source of truth, and the one customers read first.
    //
    // Still true now the card shows a figure (spec 179) — more so. The amount is fetched and passed
    // in; a literal pasted back here would quietly outrank Stripe on the one screen that must be
    // believed, and this is the check that notices. `$0` stays: the free tier costs nothing, which
    // is a fact about the product rather than a price anyone can change.
    const offenders = LANDING_STRINGS.filter(
      (s) => /(^|\s)[$£€]\s?\d/.test(s) && !/\$0\b/.test(s)
    );
    expect(offenders).toEqual([]);
  });

  // Spec 196. Three claims about importing are easy to write and each would be false. They are
  // tests rather than prose in the spec because the next person to edit this file will not have
  // read the spec.
  it("never says an imported project gets rebuilt, because no code is written or moved", () => {
    // Airrow's servers write no application code, and `/cleanup` changes none at all: it rewrites
    // the foundation's documents to describe the stack that is already there.
    const offenders = LANDING_STRINGS.filter((s) =>
      /rebuild|restructure|rewrite your|rewrites your|migrate your|refactor your/i.test(s)
    );
    expect(offenders).toEqual([]);
  });

  it("never frames hidden mode against an employer, because it hides files and nothing else", () => {
    // Keeping files out of a shared repository is all it does. It grants no access nobody had, and
    // selling it as concealment would be untrue as well as a bad thing to sell (spec 187).
    const offenders = LANDING_STRINGS.filter((s) =>
      /\bemployer\b|\bboss\b|behind (your|their) (team|company|back)|without your (team|company|employer) (knowing|noticing)/i.test(
        s
      )
    );
    expect(offenders).toEqual([]);
  });

  it("promises no pipeline in the hidden mode, because a workflow in an ignored folder cannot run", () => {
    const hidden = strings(copy.DELIVERY_MODES.find((mode) => mode.key === "hidden"));
    expect(hidden.length).toBeGreaterThan(0);
    // Naming CI here is fine only where the sentence says there is none. A promise is a sentence
    // that mentions it and does not deny it.
    const offenders = hidden.filter(
      (s) =>
        /\b(ci|cd|pipeline|workflow|github actions)\b/i.test(s) &&
        !/\b(no|not|never|cannot|without)\b/i.test(s)
    );
    expect(offenders).toEqual([]);
  });
});
