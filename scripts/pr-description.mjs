// Builds a pull request body from the specs the PR touches, its commit subjects and the
// linked issue — so a reviewer gets the context without reading the diff first (spec 53).
//
// Pure string handling on purpose: `.github/workflows/branch-policy.yml` feeds it what `gh`
// already knows (changed files on argv, commit subjects on stdin) and pipes the result back
// into `gh pr edit --body-file -`. That keeps the fiddly parts — a one-liner that wraps over
// several blockquote lines, the fallbacks — testable in `pr-description.test.mjs`.
//
// Form follows how many specs the PR touches: one spec gets the detailed shape, several get
// a summary list (that is what a `feature/* -> develop` or a `develop -> main` release is).

import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * The one-liner sits in a blockquote under the H1 and often wraps over several `>` lines.
 * Reading only the first line cuts the sentence in half, so consume the whole block.
 */
export function extractOneLiner(spec) {
  const lines = spec.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes("**In one sentence:**"));
  if (start === -1) return null;

  const parts = [];
  for (let i = start; i < lines.length && lines[i].startsWith(">"); i++) {
    parts.push(lines[i].replace(/^>\s?/, "").trim());
  }
  return parts.join(" ").replace("**In one sentence:**", "").trim() || null;
}

/**
 * Specs written before the current template have no one-liner. Their H1 is the fallback —
 * both `# Spec 46 — Title` and the older `# Spec: Title` resolve to `Title`.
 */
export function extractTitle(spec) {
  const match = spec.match(/^#\s*Spec[:\s]*\d*\s*[—-]?\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

/** One line describing a spec: its one-liner, else its title, else nothing usable. */
export function summarize(spec) {
  return extractOneLiner(spec) ?? extractTitle(spec);
}

/** The checkbox items under `## Acceptance criteria`, with wrapped lines folded back in. */
export function extractCriteria(spec) {
  const afterHeading = spec.split(/^## Acceptance criteria[^\n]*$/m)[1];
  if (!afterHeading) return [];

  const items = [];
  for (const line of afterHeading.split(/^#{2,3} /m)[0].split(/\r?\n/)) {
    if (/^- \[[ xX]\]/.test(line)) {
      items.push(line.replace(/^- \[[ xX]\]\s*/, "").trim());
    } else if (items.length > 0 && /^\s+\S/.test(line)) {
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }
  return items;
}

/** `specs/46-auto-assign-reviewer.md` -> `46`. Null for anything not numbered. */
export function specNumber(path) {
  const match = basename(path).match(/^(\d+)-/);
  return match ? match[1] : null;
}

function specLink(path, urlBase) {
  return urlBase ? `[${path}](${urlBase}/${path})` : `\`${path}\``;
}

const FOOTER = "<sub>Genererad från specen när PR:en öppnades — redigera fritt.</sub>";

/**
 * @param {{ specs: {path: string, text: string}[], commits: string[], issue?: string|null,
 *           specUrlBase?: string|null }} input
 */
export function buildBody({ specs, commits, issue = null, specUrlBase = null }) {
  const sections = [];

  if (specs.length === 1) {
    const [spec] = specs;
    sections.push(summarize(spec.text) ?? "_Specen saknar både enradare och rubrik._");

    const criteria = extractCriteria(spec.text);
    if (criteria.length > 0) {
      // Rendered unchecked: this is the reviewer's checklist, not the author's progress.
      sections.push(
        ["### Acceptanskriterier att granska mot", ...criteria.map((c) => `- [ ] ${c}`)].join("\n")
      );
    }
  } else if (specs.length > 1) {
    sections.push(`Den här PR:en samlar ${specs.length} specar.`);
    sections.push(
      specs
        .map((spec) => {
          const number = specNumber(spec.path);
          const summary = summarize(spec.text) ?? "_ingen sammanfattning i specen_";
          return `- ${number ? `**#${number}** — ` : ""}${summary}`;
        })
        .join("\n")
    );
  } else {
    sections.push("_Ingen spec hittades för den här grenen._");
  }

  if (commits.length > 0) {
    sections.push(["### Commits", ...commits.map((c) => `- ${c}`)].join("\n"));
  }

  const references = [];
  if (issue) references.push(`Issue: #${issue}`);
  if (specs.length > 0) {
    references.push(`Spec: ${specs.map((s) => specLink(s.path, specUrlBase)).join(" · ")}`);
  }
  if (references.length > 0) sections.push(references.join(" · "));

  sections.push(FOOTER);
  return `${sections.join("\n\n")}\n`;
}

function parseArgs(argv) {
  const specPaths = [];
  let issue = null;
  let specUrlBase = null;

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--spec") specPaths.push(argv[++i]);
    else if (argv[i] === "--issue") issue = argv[++i];
    else if (argv[i] === "--spec-url-base") specUrlBase = argv[++i];
  }
  return { specPaths, issue, specUrlBase };
}

function main() {
  const { specPaths, issue, specUrlBase } = parseArgs(process.argv.slice(2));
  const specs = specPaths.map((path) => ({ path, text: readFileSync(path, "utf8") }));
  const commits = readFileSync(0, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  process.stdout.write(buildBody({ specs, commits, issue, specUrlBase }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
