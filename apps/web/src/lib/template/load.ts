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

/** Enumerate every template file, excluding the meta file, with repo-relative POSIX paths. */
export function loadTemplate(): TemplateFile[] {
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
  return files;
}
