import { describe, expect, it } from "vitest";

import { buildBody, extractCriteria, extractOneLiner, extractTitle, summarize } from "./pr-description.mjs";

const CURRENT_TEMPLATE = `# Spec 46 — Automatisk reviewer

> **In one sentence:** En PR mot \`develop\` ska få en reviewer tilldelad automatiskt när
> den öppnas, så att granskningen landar hos någon.

## Acceptance criteria

- [x] En PR som öppnas mot \`develop\` får en reviewer.
- [ ] Hittas ingen kandidat failar inte körningen — den loggar en
      tydlig varning.

### Verification

- Manuellt.
`;

const LEGACY_TEMPLATE = `# Spec: Enforce PR merge-direction at the PR level

**GitHub issue:** #29 — "Rules for merging."

## Acceptance criteria

- [x] Something.
`;

describe("extractOneLiner", () => {
  it("joins a one-liner that wraps over several blockquote lines", () => {
    expect(extractOneLiner(CURRENT_TEMPLATE)).toBe(
      "En PR mot `develop` ska få en reviewer tilldelad automatiskt när den öppnas, så att granskningen landar hos någon."
    );
  });

  it("returns null when the spec predates the template", () => {
    expect(extractOneLiner(LEGACY_TEMPLATE)).toBeNull();
  });
});

describe("extractTitle", () => {
  it("reads the numbered heading of a current spec", () => {
    expect(extractTitle(CURRENT_TEMPLATE)).toBe("Automatisk reviewer");
  });

  it("reads the unnumbered heading of a legacy spec", () => {
    expect(extractTitle(LEGACY_TEMPLATE)).toBe("Enforce PR merge-direction at the PR level");
  });
});

describe("summarize", () => {
  it("falls back to the heading when there is no one-liner", () => {
    expect(summarize(LEGACY_TEMPLATE)).toBe("Enforce PR merge-direction at the PR level");
  });
});

describe("extractCriteria", () => {
  it("folds wrapped criterion lines back into one item", () => {
    expect(extractCriteria(CURRENT_TEMPLATE)).toEqual([
      "En PR som öppnas mot `develop` får en reviewer.",
      "Hittas ingen kandidat failar inte körningen — den loggar en tydlig varning."
    ]);
  });

  it("stops at the Verification subsection", () => {
    expect(extractCriteria(CURRENT_TEMPLATE)).toHaveLength(2);
  });

  it("returns nothing when the spec has no criteria section", () => {
    expect(extractCriteria("# Spec 1 — Nothing here")).toEqual([]);
  });
});

describe("buildBody", () => {
  it("describes a single-spec PR with its one-liner and a review checklist", () => {
    const body = buildBody({
      specs: [{ path: "specs/46-auto-assign-reviewer.md", text: CURRENT_TEMPLATE }],
      commits: ["feat(ci): request a reviewer"],
      issue: "46"
    });

    expect(body).toContain("En PR mot `develop` ska få en reviewer tilldelad automatiskt");
    expect(body).toContain("### Acceptanskriterier att granska mot");
    // Unchecked even though the spec ticked it — the reviewer ticks as they verify.
    expect(body).toContain("- [ ] En PR som öppnas mot `develop` får en reviewer.");
    expect(body).not.toContain("- [x]");
    expect(body).toContain("- feat(ci): request a reviewer");
    expect(body).toContain("Issue: #46");
    expect(body).toContain("`specs/46-auto-assign-reviewer.md`");
  });

  it("lists one line per spec when the PR collects several", () => {
    const body = buildBody({
      specs: [
        { path: "specs/46-auto-assign-reviewer.md", text: CURRENT_TEMPLATE },
        { path: "specs/29-branch-policy.md", text: LEGACY_TEMPLATE }
      ],
      commits: []
    });

    expect(body).toContain("samlar 2 specar");
    expect(body).toContain("- **#46** — En PR mot `develop` ska få en reviewer");
    // The legacy spec has no one-liner, so its heading carries the line instead of nothing.
    expect(body).toContain("- **#29** — Enforce PR merge-direction at the PR level");
    expect(body).not.toContain("### Acceptanskriterier");
  });

  it("falls back to the commit list when no spec was found", () => {
    const body = buildBody({ specs: [], commits: ["chore: tidy up"], issue: "12" });

    expect(body).toContain("_Ingen spec hittades för den här grenen._");
    expect(body).toContain("- chore: tidy up");
    expect(body).toContain("Issue: #12");
  });

  it("omits the commit section when there are no commits", () => {
    const body = buildBody({ specs: [], commits: [] });

    expect(body).not.toContain("### Commits");
  });

  it("links the spec when a blob base is known", () => {
    const body = buildBody({
      specs: [{ path: "specs/46-auto-assign-reviewer.md", text: CURRENT_TEMPLATE }],
      commits: [],
      specUrlBase: "https://github.com/MS-Flow/airrow/blob/abc123"
    });

    expect(body).toContain(
      "[specs/46-auto-assign-reviewer.md](https://github.com/MS-Flow/airrow/blob/abc123/specs/46-auto-assign-reviewer.md)"
    );
  });
});
