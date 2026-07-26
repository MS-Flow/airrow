// Reads the canonical `template/**` scaffold from disk for the generation engine.
// Server-side only: the engine stays pure (no I/O, no env), so the app does the file access
// and passes the files in (constitution §I).
import fs from "node:fs";
import path from "node:path";
import type { TemplateFile } from "@airrow/engine";

/** Meta file describing the template — never generated into a customer project. */
const META_FILE = ".airrow-template.json";

function findTemplateDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, "template");
    if (fs.existsSync(path.join(candidate, META_FILE))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Canonical template not found: no template/${META_FILE} above ${process.cwd()}. ` +
      "Generation cannot run without it."
  );
}

/**
 * Read once per server, not once per request. The landing page reads the scaffold on every
 * view (it shows the real file count and the real command descriptions), and doing that
 * meant walking the tree and synchronously reading all 22 files before the page could
 * render — the reason clicking the logo felt slow.
 *
 * The template ships inside the deployment and cannot change under a running server, so
 * caching it is safe. Dev re-reads every time, so editing `template/**` still shows up on
 * refresh.
 */
let cached: TemplateFile[] | null = null;

/** Enumerate every template file, excluding the meta file, with repo-relative POSIX paths. */
export function loadTemplate(): TemplateFile[] {
  if (cached) return cached;

  const root = findTemplateDir();
  const files: TemplateFile[] = [];

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      const rel = path.relative(root, abs).split(path.sep).join("/");
      if (rel === META_FILE) continue;
      files.push({ path: rel, content: fs.readFileSync(abs, "utf8") });
    }
  };

  walk(root);
  if (process.env.NODE_ENV === "production") cached = files;
  return files;
}
