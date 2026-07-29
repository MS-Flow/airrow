// Where a link inside a previewed file points (spec 66 follow-up).
//
// Generated documents cross-reference each other constantly — START_HERE.md alone links to CLAUDE.md,
// the constitution, VISION.md and BRANCHING.md. Rendered as-is those are relative hrefs, and clicking
// one navigated the browser to `/app/projects/<id>/preview/CLAUDE.md`, which is a 404. The preview is
// not a filesystem, so a link has to be resolved against the repo tree and turned into a selection.
//
// Pure and separate from the component so the path arithmetic can be tested directly: `../` climbing
// out of a directory is exactly the kind of thing that looks right and is off by one.

export type PreviewLink =
  | { kind: "external" }
  /** Same-document fragment — the browser already does the right thing. */
  | { kind: "anchor" }
  /** A path inside the repo. Existence is the caller's question; this only resolves. */
  | { kind: "file"; path: string };

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Collapse `.` and `..` segments. Climbing above the root clamps there, as it would in a repo. */
function normalize(segments: string[]): string[] {
  const out: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return out;
}

/**
 * Resolve `href`, found inside the file at `fromPath`, to something the preview can act on.
 *
 * Root-relative (`/docs/x.md`) is treated as relative to the repo root rather than the site's, which
 * is what a founder reading their own repository means by it.
 */
export function resolvePreviewLink(fromPath: string, href: string): PreviewLink {
  const trimmed = href.trim();
  if (trimmed === "") return { kind: "external" };
  if (trimmed.startsWith("#")) return { kind: "anchor" };
  if (trimmed.startsWith("//") || SCHEME.test(trimmed)) return { kind: "external" };

  // A fragment or query on a file link points into the target, not at a different file.
  const target = trimmed.split("#")[0]?.split("?")[0] ?? "";
  if (target === "") return { kind: "anchor" };

  const base = trimmed.startsWith("/") ? [] : fromPath.split("/").slice(0, -1);
  return { kind: "file", path: normalize([...base, ...target.split("/")]).join("/") };
}
