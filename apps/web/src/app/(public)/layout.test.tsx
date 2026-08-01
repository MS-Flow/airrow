// The one place Archer is mounted (spec 158).
//
// Two properties, and the second is the one that is easy to lose: the panel renders on the public
// pages, and it renders on *only* those. Spec 141 got the exclusion for free by hanging the widget
// off a single page; a shared mount has to earn it, which is what the route group and the last two
// tests here are for.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

type FakeSession = { user: { id: string }; org: { id: string } } | null;
const session = vi.hoisted((): { current: FakeSession } => ({ current: null }));

vi.mock("@/lib/auth", () => ({
  getSession: () => Promise.resolve(session.current)
}));

// Stubbed so the destination the layout *chose* is readable. The panel's own behaviour is covered
// where it lives, in `features/chat/ChatWidget.test.tsx`.
vi.mock("@/features/chat/ChatWidget", () => ({
  ChatWidget: ({ ctaHref }: { ctaHref: string }) => <a href={ctaHref}>Archer</a>
}));

import PublicLayout from "./layout";

/** From the workspace root Vitest runs in, not from `import.meta.url`: this file is a jsdom test and
    the document's base URL there is not a `file:` one. */
const APP_DIR = join(process.cwd(), "src", "app");

/** Every file under `src/app`, so a claim about where the widget is mounted can be checked. */
function appFiles(dir: string = APP_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? appFiles(join(dir, entry.name)) : [join(dir, entry.name)]
  );
}

const mountsTheWidget = (file: string): boolean => readFileSync(file, "utf8").includes("ChatWidget");

describe("the public layout", () => {
  it("renders the page it wraps, and Archer beside it", async () => {
    session.current = null;
    render(await PublicLayout({ children: <p>a public page</p> }));

    expect(screen.getByText("a public page")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Archer" })).toBeInTheDocument();
  });

  it("sends a visitor to the interview and a signed-in founder to their project form", async () => {
    session.current = null;
    const { unmount } = render(await PublicLayout({ children: null }));
    expect(screen.getByRole("link", { name: "Archer" })).toHaveAttribute("href", "/start");
    unmount();

    session.current = { user: { id: "user1" }, org: { id: "org1" } };
    render(await PublicLayout({ children: null }));
    expect(screen.getByRole("link", { name: "Archer" })).toHaveAttribute(
      "href",
      "/app/projects/new"
    );
  });

  it("is the only mount point, so no page can grow a second one", () => {
    const mounts = appFiles().filter(
      (file) => !file.endsWith(".test.tsx") && mountsTheWidget(file)
    );

    expect(mounts).toHaveLength(1);
    expect(mounts[0]).toMatch(/\(public\)[\\/]layout\.tsx$/);
  });

  it("keeps the panel out of the signed-in app entirely", () => {
    // `app/app/**` sits outside this route group, which is what makes the exclusion structural
    // rather than a runtime check. This asserts nobody has worked around the structure.
    const inTheApp = appFiles().filter(
      (file) => /[\\/]app[\\/]app[\\/]/.test(file) && mountsTheWidget(file)
    );

    expect(inTheApp).toEqual([]);
  });
});
