// The landing page shows the real scaffold rather than a description of one: the server
// reads the canonical `template/**` from disk (constitution §I — the app does the file
// access) so the section can never drift from what generation actually produces.
import { loadTemplate } from "@/lib/template/load";
import { FOUNDATION_HIGHLIGHTS, SPEC_LOOP } from "./copy";

const COMMANDS_DIR = ".claude/commands/";

export interface LoopStep {
  /** Command name as it is typed, without the leading slash. */
  name: string;
  description: string;
}

export interface Highlight {
  path: string;
  reason: string;
}

export interface Foundation {
  fileCount: number;
  /** The spec lifecycle, in the order an issue travels through it. */
  loop: LoopStep[];
  highlights: Highlight[];
}

/** `description:` from the command's frontmatter — the one line the command itself shows. */
function readDescription(content: string): string | null {
  const match = /^description:\s*(.+)$/m.exec(content);
  return match?.[1]?.trim() ?? null;
}

/**
 * Throws when the scaffold no longer contains what the section promises: a renamed
 * template file must fail the build and the test suite, never render an empty card.
 */
export function readFoundation(): Foundation {
  const files = loadTemplate();
  const paths = new Set(files.map((f) => f.path));

  const loop = SPEC_LOOP.map((name) => {
    const file = files.find((f) => f.path === `${COMMANDS_DIR}${name}.md`);
    if (!file) throw new Error(`Template command /${name} is missing.`);
    const description = readDescription(file.content);
    if (!description) throw new Error(`Template command /${name} has no description.`);
    return { name, description };
  });

  for (const { path } of FOUNDATION_HIGHLIGHTS) {
    if (!paths.has(path)) throw new Error(`Highlighted template file ${path} is missing.`);
  }

  return { fileCount: files.length, loop, highlights: [...FOUNDATION_HIGHLIGHTS] };
}
