// The curated design directions, as installable code rather than prose (spec 165).
//
// Pure data, no runtime deps — read by the interview (to draw the previews), by the engine (to write
// UI_ARCHITECTURE.md and the `/start` install step) and by the notices file the foundation ships.

/**
 * Where a design direction's code comes from, and what we owe its author for using it.
 *
 * One source for all five directions: shadcn/ui, which `/start` already installs for every Tailwind
 * stack. Five *libraries* would mean five licences, five install paths and five ways for the step to
 * fail; what actually differs between the directions is the theme, and a theme is ours to write.
 */
export interface UiKitSource {
  /** npm package the CLI is invoked from. */
  pkg: string;
  /**
   * Exact version — never a range, and never `@latest`.
   *
   * Different from the `@latest` the framework scaffolders are deliberately left at: those run once
   * and leave no trace of themselves, whereas this one writes `components.json` and the theme every
   * later `add` resolves against, and `UI_ARCHITECTURE.md` now *names* the version it wrote. An
   * unpinned version there is a document that becomes untrue on someone else's release schedule.
   */
  version: string;
  /** SPDX identifier. Must be in `PERMISSIVE_LICENCES` — asserted, not reviewed by eye. */
  licence: string;
  holder: string;
  homepage: string;
  /** The notice the generated repo carries. Verbatim: an MIT licence is only satisfied in full. */
  licenceText: string;
}

/**
 * Licences a foundation may install into a founder's repository.
 *
 * Permissive only. A copyleft licence would attach terms to the founder's own product, which is not
 * a decision a generator gets to make for them, and a "free to download" licence that forbids
 * redistribution inside a tool is not a licence we have at all.
 */
export const PERMISSIVE_LICENCES = ["MIT", "Apache-2.0", "ISC", "BSD-2-Clause", "BSD-3-Clause"] as const;

const MIT_LICENCE_TEXT = `MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

export const SHADCN_UI: UiKitSource = {
  pkg: "shadcn",
  version: "4.16.1",
  licence: "MIT",
  holder: "shadcn",
  homepage: "https://ui.shadcn.com",
  licenceText: MIT_LICENCE_TEXT
};

/**
 * The palette a direction is drawn and built in.
 *
 * Six values, because six is what it takes to tell one direction from another at a glance and to
 * write a theme block that is worth installing. They are the values `/start` writes into the
 * project's stylesheet, and the same values the interview's preview is drawn from — one source, so
 * the picture a founder picked cannot drift from the theme they got.
 */
export interface UiKitPalette {
  /** Page background. */
  bg: string;
  /** Panel/card background, sitting on `bg`. */
  surface: string;
  /** Body text. */
  fg: string;
  /** Secondary text, borders' louder sibling. */
  muted: string;
  /** Hairlines and dividers. */
  border: string;
  /** The one colour that means "action". */
  accent: string;
}

/**
 * The visual language a direction is — and, deliberately, *not* a layout.
 *
 * This used to be an anatomy: a nav position, a row count, a surface kind. That was the wrong thing
 * to choose between. A founder picking a look was picking a sidebar with six links, and the first
 * screen then had a sidebar with six links whether or not their product wanted one — the layout
 * outranked what they had actually written about their product. **The screens come from their
 * answers. The direction is only how those screens look**: colour, type, corner, spacing, surface
 * and motion.
 *
 * That is also why the preview is a specimen rather than a screenshot of an app. What a founder is
 * confirming when they pick is "yes, that palette and that type", not "yes, put the navigation
 * there".
 */
export interface UiKitDesign {
  /** How the brand mark leads — every one of these is minimal and leads with it, differently. */
  logo: "mark and large wordmark" | "the mark alone" | "mark and monospace prompt";
  /** The headline treatment, in words a build can act on. */
  headline: string;
  /** The type pairing and how it reads. */
  typography: string;
  /** Corner radius, in the unit the theme block uses. */
  radius: string;
  /**
   * How the first impression is composed.
   *
   * Composition, not layout, and the distinction is the whole point of this record: this is how the
   * brand, the headline and the one action sit together on a page someone lands on — the part of a
   * visual language you can see in a thumbnail. It says nothing about where navigation lives, what a
   * list looks like, or how someone moves between screens. Those come from the founder's answers.
   */
  composition: "left-stacked" | "centred" | "terminal";
  /** How much air there is between things. */
  spacing: "airy" | "balanced" | "tight";
  /** What separates one surface from another. */
  surfaces: "hairline borders" | "flat, separated by colour" | "single-pixel outlines";
  /** What moves, and how much. */
  motion: string;
}

/** One curated direction: the look, and the code that produces it. */
export interface UiKit {
  /** The `uiDirection` option this belongs to — the two are matched by this value. */
  id: string;
  name: string;
  /** The neutral family recorded in `components.json`. */
  baseColor: "neutral" | "slate" | "stone" | "zinc" | "gray";
  /** Whether the theme's own default is the dark one. */
  darkFirst: boolean;
  light: UiKitPalette;
  dark: UiKitPalette;
  /** One line on who tends to want this, for the founder choosing. */
  suits: string;
  /** The visual language itself. See `UiKitDesign`. */
  design: UiKitDesign;
  /**
   * A real capture of `blocks` running in this theme, served from `apps/web/public`.
   *
   * **Unset on every kit today, and that is a statement rather than an omission.** A capture is the
   * one thing the drawn preview cannot be — proof that these exact blocks produce this exact screen —
   * and it is also a second copy of the design that goes stale silently the day a block changes
   * upstream or a token moves here. So the rule is: a capture only earns its place while it is
   * current, and the drawing is what ships until someone runs the blocks and takes one.
   *
   * When one is set, `UiKitPreview` shows it instead of drawing. Deleting it goes back to the
   * drawing, which is always true — so a stale capture is never the only option.
   */
  screenshot?: string;
  source: UiKitSource;
}
/**
 * The curated directions, in the order the question offers them.
 *
 * Three, and all three are the same *kind* of thing: a modern, minimal look that leads with the
 * brand mark and gets out of the way. What separates them is colour, contrast and warmth — the
 * choices a founder can actually hold an opinion about before they have seen their product — not
 * where the navigation goes. Layout is decided by what they wrote about what they are building, and
 * it would be strange for a picture to overrule that.
 *
 * §0 says to offer choices only where they genuinely matter. Three that differ in temperature beat
 * five that differ in hue, and the way out of all three is the option that says "I'll show you".
 *
 * Every palette is one we chose; nothing is copied from another product's stylesheet, and no
 * third-party product is named — the same boundary spec 159 drew for the founder's own references,
 * applied to ours.
 */
export const UI_KITS: UiKit[] = [
  {
    id: "soft_minimal",
    name: "Soft minimal",
    baseColor: "stone",
    darkFirst: false,
    suits: "Studios, consultancies, anything sold on taste rather than features.",
    light: {
      bg: "#faf9f7",
      surface: "#ffffff",
      fg: "#1a1917",
      muted: "#78736b",
      border: "#e9e5df",
      accent: "#2f5d50"
    },
    dark: {
      bg: "#14130f",
      surface: "#1c1b17",
      fg: "#f0ede6",
      muted: "#9c968a",
      border: "#2b2924",
      accent: "#7fbfa8"
    },
    design: {
      composition: "left-stacked",
      logo: "mark and large wordmark",
      headline: "One very large headline, set tight, with nothing competing beside it.",
      typography: "One humanist sans throughout; size and weight carry every level of hierarchy.",
      radius: "0.75rem",
      spacing: "airy",
      surfaces: "hairline borders",
      motion: "Almost none — things fade, nothing slides."
    },
    screenshot: "/ui-directions/soft_minimal.jpg",
    source: SHADCN_UI
  },
  {
    id: "bold_contrast",
    name: "Bold contrast",
    baseColor: "zinc",
    darkFirst: true,
    suits: "Developer tools, AI products, anything that wants to look new.",
    light: {
      bg: "#ffffff",
      surface: "#fafafa",
      fg: "#0a0a0a",
      muted: "#6b6b6b",
      border: "#e4e4e4",
      accent: "#c8392b"
    },
    dark: {
      bg: "#08080a",
      surface: "#111114",
      fg: "#fafafa",
      muted: "#8a8a94",
      border: "#212127",
      accent: "#ff6b5c"
    },
    design: {
      composition: "centred",
      logo: "the mark alone",
      headline: "Oversized headline against small, quiet body text — the jump is the design.",
      typography: "A geometric sans for headings, monospace for anything a developer would copy.",
      radius: "0.375rem",
      spacing: "balanced",
      surfaces: "flat, separated by colour",
      motion: "Short and deliberate: state changes are visible, nothing is decorative."
    },
    screenshot: "/ui-directions/bold_contrast.jpg",
    source: SHADCN_UI
  },
  {
    id: "stark_terminal",
    name: "Stark & technical",
    baseColor: "gray",
    darkFirst: true,
    suits: "Developer tools, CLIs, infrastructure — anything sold to people who live in a terminal.",
    light: {
      bg: "#fcfdfc",
      surface: "#f2f5f3",
      fg: "#0a0c0a",
      muted: "#5f6b62",
      border: "#dde3df",
      accent: "#07794a"
    },
    dark: {
      bg: "#050706",
      surface: "#0b100d",
      fg: "#d6e7db",
      muted: "#6d8175",
      border: "#17211b",
      accent: "#2ee06a"
    },
    design: {
      composition: "terminal",
      logo: "mark and monospace prompt",
      headline: "A short, plain headline set close, with a monospace label above it.",
      typography: "A neutral sans for reading, monospace for anything that could be typed or copied.",
      radius: "0.125rem",
      spacing: "tight",
      surfaces: "single-pixel outlines",
      motion: "A cursor blinks. Nothing else moves, ever."
    },
    screenshot: "/ui-directions/stark_terminal.jpg",
    source: SHADCN_UI
  }
];

/** The surface treatment, shortened for the caption — the long form belongs in the brief. */
const SURFACE_WORDS: Record<UiKitDesign["surfaces"], string> = {
  "hairline borders": "hairlines",
  "flat, separated by colour": "flat",
  "single-pixel outlines": "outlines"
};

/**
 * The line shown under a direction — a description of the *look*, never of a layout.
 *
 * It says colour temperature, spacing and surface, because those are what the founder is choosing
 * and what survives into every screen. It deliberately does not describe navigation, rows or panels:
 * the picture is a specimen, the screens come from the founder's own answers, and a caption that
 * counted things in the image would be promising a layout nobody chose.
 *
 * The corner radius was here and is not any more. `0.125rem corners` is a value, not a description —
 * it reads as a spec sheet beside a picture that already shows the corners, and a founder comparing
 * three looks has no use for the number.
 */
export function describeUiKit(kit: UiKit): string {
  return [
    kit.darkFirst ? "dark-first" : "light-first",
    `${kit.design.spacing} spacing`,
    SURFACE_WORDS[kit.design.surfaces]
  ].join(" · ");
}

/** Kept as the single caption entry point; both pictures show the same visual language. */
export function uiKitCaption(kit: UiKit): string {
  return describeUiKit(kit);
}

/**
 * The `uiKit` value an imported project uses to say the look is already there (spec 199).
 *
 * Deliberately not a kit: it names no palette, no type and no library, because the answer is that
 * the founder's own code has all three. It is a value of `uiKit` rather than a flag beside it so
 * that one field still decides the theme — and `uiKitFor` resolving it to null is what makes
 * "described, never installed" true everywhere without a single extra branch.
 */
export const KEEP_EXISTING_UI = "existing";

export function uiKitFor(id: string | undefined | null): UiKit | null {
  if (!id) return null;
  return UI_KITS.find((k) => k.id === id) ?? null;
}

/** Every distinct source across the kits — what a repo owes attribution to. */
export function uiKitSources(): UiKitSource[] {
  const seen = new Map<string, UiKitSource>();
  for (const kit of UI_KITS) seen.set(`${kit.source.pkg}@${kit.source.version}`, kit.source);
  return [...seen.values()];
}
