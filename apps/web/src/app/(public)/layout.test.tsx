// Where Archer is mounted for a signed-out visitor (spec 158), and the structure that keeps the
// mounts countable (spec 159).
//
// Spec 158's second property — that the panel renders on the public pages and *only* those — was
// deliberately dropped by spec 159: the signed-in founder was the one person who could not ask. What
// survives it is the property that made the exclusion checkable in the first place, and is the one
// worth keeping: Archer is mounted from layouts, never from a page, so nobody has to remember him.
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

  it("is mounted from the two layouts and nowhere else", () => {
    const mounts = appFiles()
      .filter((file) => !file.endsWith(".test.tsx") && mountsTheWidget(file))
      .sort();

    // Exactly two, and both of them layouts: a page that mounted its own panel would give someone
    // two Archers on one screen, and a page that forgot would be the only screen without him.
    expect(mounts).toHaveLength(2);
    expect(mounts.every((file) => file.endsWith("layout.tsx"))).toBe(true);
  });

  it("reaches the signed-in app too, from its layout", () => {
    // Spec 159: `app/app/**` is a separate tree with a separate layout, so covering it is a mount of
    // its own rather than something the public group could ever have done for it.
    const inTheApp = appFiles().filter(
      (file) => /[\\/]app[\\/]app[\\/]/.test(file) && mountsTheWidget(file)
    );

    expect(inTheApp).toHaveLength(1);
    expect(inTheApp[0]).toMatch(/app[\\/]app[\\/]layout\.tsx$/);
  });
});
