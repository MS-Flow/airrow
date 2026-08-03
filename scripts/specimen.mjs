// The page each design direction is photographed as (spec 165).
//
// A **specimen**, not an application. It shows the brand mark, the headline treatment, the palette
// and the surfaces — the things a founder is actually choosing between — and deliberately no
// navigation, no sidebar and no table. What goes on their screens comes from what they wrote about
// their product; a picture that showed an app layout would be promising one nobody chose.
//
// The three compositions are genuinely different pages rather than one page in three palettes,
// because `design.composition` is part of the visual language: where the brand, the headline and the
// one action sit relative to each other is most of what "this looks modern" means, and it is visible
// in a thumbnail. Everything is built from theme tokens, so each direction colours its own.

/**
 * Where the real Airrow mark lands in the scratch app.
 *
 * The approved artwork is a raster with no vector original (`components/brand/mark.tsx` says why),
 * so the runner copies the file rather than this module inlining a redrawn path — a traced version
 * would be a different logo, which is the one thing a brand asset may not be.
 */
export const MARK_SRC = "/brand/airrow-mark.png";

/** The brand, in whichever of the three ways this direction leads with it. */
function brand(kit, size) {
  const big = size === "xl";
  if (kit.design.logo === "mark and large wordmark") {
    // Sized and nudged to the wordmark's cap height rather than its line box. Matched to the line
    // box, the mark overhangs the word top and bottom and reads as two things placed near each
    // other instead of one lockup.
    return [
      '<span className="flex items-center gap-4">',
      `  <img src="${MARK_SRC}" alt="" className="${big ? "h-11" : "h-8"} w-auto translate-y-[3px] object-contain" />`,
      `  <span className="${big ? "text-5xl" : "text-3xl"} font-semibold tracking-[-0.03em]">Airrow</span>`,
      "</span>"
    ].join("\n");
  }
  if (kit.design.logo === "the mark alone") {
    // The mark and nothing else. A brand confident enough to drop its own name is the most direct
    // statement this direction makes, and spelling it out beside the mark would undo it.
    return `<img src="${MARK_SRC}" alt="Airrow" className="${big ? "h-36" : "h-28"} w-auto object-contain" />`;
  }
  // Mark, then prompt: technical, without the whole page pretending to be a shell.
  return [
    '<span className="flex items-center gap-4">',
    `  <img src="${MARK_SRC}" alt="" className="${big ? "h-12" : "h-9"} w-auto object-contain" />`,
    '  <span className="flex items-baseline gap-2 font-mono">',
    '    <span className="text-primary">$</span>',
    `    <span className="${big ? "text-3xl" : "text-2xl"} font-medium tracking-tight">airrow</span>`,
    `    <span className="inline-block ${big ? "h-6 w-3" : "h-5 w-2.5"} translate-y-1 bg-primary" />`,
    "  </span>",
    "</span>"
  ].join("\n");
}

/** The four theme colours, stated — most of what is being chosen. */
const SWATCHES = [
  '<span className="flex gap-2">',
  '  <span className="size-5 rounded-full bg-primary" />',
  '  <span className="size-5 rounded-full bg-foreground" />',
  '  <span className="size-5 rounded-full bg-muted-foreground" />',
  '  <span className="size-5 rounded-full bg-border" />',
  "</span>"
].join("\n");

function surfaceClasses(kit) {
  const treatment = {
    "hairline borders": "border border-border",
    "flat, separated by colour": "ring-1 ring-primary/20",
    "single-pixel outlines": "border border-primary/30"
  }[kit.design.surfaces];
  if (!treatment) throw new Error(`no surface treatment for "${kit.design.surfaces}" (${kit.id})`);
  return `rounded-[var(--radius)] bg-card ${treatment}`;
}

/**
 * Editorial and quiet: everything on one left axis, the wordmark large, the headline given the room
 * to be the only thing on the page. Air is the design.
 */
function leftStacked(kit) {
  const card = surfaceClasses(kit);
  return `      <div className="flex items-start justify-between">
        ${brand(kit, "xl")}
        ${SWATCHES}
      </div>

      <div className="mt-10 grid grid-cols-[auto_1fr] gap-x-10">
        {/* A rule rather than a box: the only ornament this direction allows itself. */}
        <span className="mt-3 h-px w-16 bg-primary" />
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Engineering foundations</p>
          <h1 className="mt-6 max-w-3xl text-6xl font-semibold leading-[1.0] tracking-[-0.04em]">
            The foundation your
            <br />
            product <span className="italic text-primary">starts</span> from.
          </h1>
          <p className="mt-7 max-w-md text-lg leading-[1.7] text-muted-foreground">
            Documents, rules and a workflow — written for what you are building, so the first week of
            code has something to stand on.
          </p>
          <div className="mt-9 flex items-center gap-8">
            <span className="rounded-[var(--radius)] bg-primary px-8 py-4 text-sm font-medium text-background">
              Start a foundation
            </span>
            <span className="text-sm font-medium underline decoration-1 underline-offset-[6px]">
              See what it writes
            </span>
          </div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-[auto_1fr] gap-x-10">
        <span className="h-px w-16" />
        <div className="${card} grid grid-cols-3 divide-x divide-border">
          <div className="px-7 py-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Type</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Aa</p>
          </div>
          <div className="px-7 py-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Voice</p>
            <p className="mt-3 text-lg leading-relaxed">Plainly, and once.</p>
          </div>
          <div className="px-7 py-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Numbers</p>
            <p className="mt-3 text-4xl font-semibold tabular-nums">1,284</p>
          </div>
        </div>
      </div>`;
}

/**
 * A statement: centred, the headline oversized enough to be the whole page, the accent doing the
 * shouting. Nothing decorative — the size *is* the decoration.
 */
function centred(kit) {
  const card = surfaceClasses(kit);
  return `      <div className="flex flex-col items-center">
        ${brand(kit, "md")}
        <p className="mt-8 rounded-full border border-border px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          v1.0 — now in private beta
        </p>
        <h1 className="mt-6 max-w-4xl text-center text-6xl font-semibold leading-[0.98] tracking-[-0.045em]">
          Ship the boring part
          <br />
          <span className="text-primary">on day one.</span>
        </h1>
        <p className="mt-6 max-w-xl text-center text-base text-muted-foreground">
          Airrow writes the foundation — architecture, conventions, CI — so your first commit is the
          product and not the plumbing.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <span className="rounded-[var(--radius)] bg-primary px-7 py-3.5 text-sm font-semibold text-background">
            Get started
          </span>
          <span className="rounded-[var(--radius)] border border-border px-7 py-3.5 font-mono text-sm">
            npx airrow init
          </span>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4">
        <div className="${card} p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">01</p>
          <p className="mt-3 font-medium">Answer twelve questions</p>
        </div>
        <div className="${card} p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">02</p>
          <p className="mt-3 font-medium">Preview every file</p>
        </div>
        <div className="${card} p-5">
          <p className="font-mono text-xs uppercase tracking-widest text-primary">03</p>
          <p className="mt-3 font-medium">Run one command</p>
        </div>
      </div>`;
}

/**
 * Technical, with a terminal in it — not a terminal pretending to be a page.
 *
 * The earlier version made the whole screen a shell session, which read as a screenshot of a tool
 * rather than as a look someone could build a product in. What survives is the character: monospace
 * for anything that could be typed, sharp corners, colour used only where it means something. The
 * session is now one element beside a plain headline, which is what "terminal feeling" looks like as
 * a design direction rather than as a costume.
 */
function terminal(kit) {
  const card = surfaceClasses(kit);
  const line = (prompt, text, tone = "") =>
    [
      '          <p className="flex gap-3">',
      `            <span className="${prompt ? "text-primary" : "opacity-0"} select-none">$</span>`,
      `            <span className="${tone}">${text}</span>`,
      "          </p>"
    ].join("\n");

  return `      <div className="flex items-center justify-between">
        ${brand(kit, "xl")}
        <span className="font-mono text-sm text-muted-foreground">v1.0.0 — MIT</span>
      </div>

      <div className="mt-12 grid grid-cols-[1fr_1.15fr] items-center gap-14">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">engineering foundations</p>
          <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-[-0.03em]">
            Your foundation,
            <br />
            in one command.
          </h1>
          <p className="mt-6 max-w-sm leading-relaxed text-muted-foreground">
            Airrow writes the architecture, the conventions and the workflow — then hands you the
            repository and gets out of the way.
          </p>
          <div className="mt-8 flex items-center gap-4">
            <span className="rounded-[var(--radius)] bg-primary px-6 py-3 text-sm font-semibold text-background">
              Start free
            </span>
            <span className="font-mono text-sm text-muted-foreground">docs →</span>
          </div>
        </div>

        <div className="${card} p-7 font-mono text-base leading-[1.85]">
${line(true, "airrow init")}
${line(false, "Reading answers … 12/12", "text-muted-foreground")}
${line(false, "Stack: next.js · supabase · vercel", "text-muted-foreground")}
          <p className="mt-4 flex gap-3">
            <span className="opacity-0 select-none">$</span>
            <span className="text-primary">✓ 24 documents written</span>
          </p>
${line(false, "  SYSTEM_OVERVIEW.md", "text-muted-foreground")}
${line(false, "  UI_ARCHITECTURE.md", "text-muted-foreground")}
          <p className="mt-4 flex gap-3">
            <span className="text-primary select-none">$</span>
            <span>
              airrow ship<span className="ml-1 inline-block h-5 w-2.5 translate-y-0.5 bg-primary" />
            </span>
          </p>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-3 gap-4 font-mono text-sm">
        <div className="${card} px-5 py-4">
          <span className="text-muted-foreground">specs</span>
          <span className="ml-3 text-primary">6</span>
        </div>
        <div className="${card} px-5 py-4">
          <span className="text-muted-foreground">elapsed</span>
          <span className="ml-3 text-primary">3m 04s</span>
        </div>
        <div className="${card} px-5 py-4">
          <span className="text-muted-foreground">exit</span>
          <span className="ml-3 text-primary">0</span>
        </div>
      </div>`;
}

const COMPOSITIONS = { "left-stacked": leftStacked, centred, terminal };

export function specimenPage(kit) {
  const build = COMPOSITIONS[kit.design.composition];
  if (!build) throw new Error(`no specimen for composition "${kit.design.composition}" (${kit.id})`);
  const pad =
    kit.design.spacing === "airy" ? "px-20 py-16" : kit.design.spacing === "balanced" ? "px-16 py-14" : "px-12 py-10";

  return `export default function Specimen() {
  return (
    <main className="min-h-screen bg-background ${pad} text-foreground">
      <div className="mx-auto max-w-5xl">
${build(kit)}
      </div>
    </main>
  );
}
`;
}
