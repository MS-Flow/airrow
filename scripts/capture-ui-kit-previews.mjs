// Capture a real screenshot of each curated design direction (spec 165). Run locally; never in CI —
// it writes committed assets, which is a decision rather than a build step, and it needs a browser.
//
//   pnpm capture:ui-kits                  # every direction
//   pnpm capture:ui-kits bold_contrast
//   pnpm capture:ui-kits --keep           # leave the scratch apps for inspection
//
// What it does, per direction: scaffolds a real Next.js app, runs the *pinned* shadcn CLI to install
// the primitives, writes that direction's theme variables over the ones `init` wrote, renders a
// **specimen** of the visual language, and photographs it.
//
// A specimen and not an application, deliberately. An earlier version installed real layout blocks
// and photographed a dashboard, which made the picture promise a layout: a founder picking a look
// was picking a sidebar, and the first screen then had one whether or not their product wanted it.
// What a founder is choosing here is colour, type, corner and surface — so that is what is shown,
// and what goes on their screens comes from what they wrote about their product.
//
// The interview does not need this to work: `UiKitPreview` draws every direction from the same
// record, and that drawing can never disagree with the theme. What a capture adds is a real render —
// actual type at actual size, actual shadows — and it is worth re-taking rather than trusting once a
// token changes. Deleting a capture always falls back to the drawing.
//
// Requires: network, and Playwright's chromium. Two commands, one per line — `&&` is a parser error
// in Windows PowerShell 5.1, which is where this repository is most often run:
//   pnpm add -Dw playwright
//   pnpm exec playwright install chromium

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "packages/schemas/src/ui-kits.ts");
const OUT_DIR = path.join(ROOT, "apps/web/public/ui-directions");
const PUBLIC_PREFIX = "/ui-directions";

const CAPTURE_ROUTE = "/specimen";
// Sized to the specimen rather than to a browser window. At a full 800-odd the bottom 40% of every
// capture was empty ground, and these are shown as thumbnails a founder compares three of.
const VIEWPORT = { width: 1280, height: 680 };

/* ── Reading the kits out of the source ──────────────────────────────────────
   A parse rather than an import: this runs from `scripts/`, outside the workspace, with no build
   step. Paired with a hard failure on an empty read, so a changed shape reports a broken script
   instead of "nothing to capture, all done". */

export function readPinnedCli(source) {
  const m = /pkg:\s*"([^"]+)",\s*\n\s*version:\s*"([^"]+)"/.exec(source);
  return m ? `${m[1]}@${m[2]}` : null;
}

export function readKits(source) {
  const kits = [];
  const blockRe = /\bid:\s*"([a-z_]+)",[\s\S]*?\n    source:/g;
  let m;
  while ((m = blockRe.exec(source)) !== null) {
    const body = m[0];
    const pick = (re) => {
      const found = re.exec(body);
      return found ? found[1] : null;
    };
    const palette = (which) => {
      const p = new RegExp(`${which}:\\s*\\{([^}]+)\\}`).exec(body);
      if (!p) return null;
      const out = {};
      for (const [, k, v] of p[1].matchAll(/(\w+):\s*"(#[0-9a-fA-F]{6})"/g)) out[k] = v;
      return out;
    };
    kits.push({
      id: m[1],
      name: pick(/name:\s*"([^"]+)"/),
      baseColor: pick(/baseColor:\s*"([^"]+)"/),
      darkFirst: /darkFirst:\s*true/.test(body),
      light: palette("light"),
      dark: palette("dark"),
      design: {
        logo: pick(/logo:\s*"([^"]+)"/),
        radius: pick(/radius:\s*"([^"]+)"/),
        composition: pick(/composition:\s*"([^"]+)"/),
        spacing: pick(/spacing:\s*"([^"]+)"/),
        surfaces: pick(/surfaces:\s*"([^"]+)"/)
      }
    });
  }
  return kits;
}

/**
 * The theme block written over what `init` produced.
 *
 * Appended, so it wins on source order without having to understand the stylesheet it is overriding.
 * A dark-first direction gets its dark palette on `:root` as well, which photographs the theme the
 * founder was shown without having to toggle a class on `<html>`.
 */
export function themeCss(kit) {
  const vars = (p) =>
    [
      `  --background: ${p.bg};`,
      `  --card: ${p.surface};`,
      `  --popover: ${p.surface};`,
      `  --foreground: ${p.fg};`,
      `  --card-foreground: ${p.fg};`,
      `  --popover-foreground: ${p.fg};`,
      `  --muted-foreground: ${p.muted};`,
      `  --border: ${p.border};`,
      `  --input: ${p.border};`,
      `  --primary: ${p.accent};`,
      `  --ring: ${p.accent};`
    ].join("\n");

  const base = kit.darkFirst ? kit.dark : kit.light;
  return [
    "",
    `/* ${kit.name} — written by scripts/capture-ui-kit-previews.mjs (spec 165) */`,
    ":root {",
    `  --radius: ${kit.design.radius};`,
    vars(base),
    "}",
    ".dark {",
    vars(kit.dark),
    "}",
    ""
  ].join("\n");
}

/* ── The specimen ────────────────────────────────────────────────────────────
   Its own module: three genuinely different compositions is a page of markup each, and burying that
   in the runner made the part that actually needs reading hard to find. */

// Imported as well as re-exported: a bare `export { x } from` binds the name for importers without
// bringing it into this module's own scope, and `main` calls it.
import { MARK_SRC, specimenPage } from "./specimen.mjs";
export { specimenPage };

/* ── Running things ──────────────────────────────────────────────────────── */

function run(cmd, args, cwd) {
  const printable = `${cmd} ${args.join(" ")}`;
  console.log(`  $ ${printable}`);
  const res = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (res.status !== 0) throw new Error(`failed (exit ${res.status}): ${printable}\n  in ${cwd}`);
}

async function waitForServer(url, proc, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`dev server exited early (${proc.exitCode})`);
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Not up yet. The dev server compiles the route on first request, so this loop is also what
      // triggers that compile — the first success is a page that has actually rendered.
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  throw new Error(`dev server never served ${url}`);
}

function stopServer(proc) {
  if (proc.exitCode !== null) return;
  if (process.platform === "win32") {
    // `next dev` spawns a child; killing the node process alone leaves the port held.
    spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-proc.pid, "SIGTERM");
    } catch {
      proc.kill("SIGTERM");
    }
  }
}

/** Point each captured kit at its image, idempotently. */
export function withScreenshots(source, captured) {
  let next = source;
  for (const [id, file] of Object.entries(captured)) {
    const line = `    screenshot: "${PUBLIC_PREFIX}/${file}",\n`;
    const kitStart = next.indexOf(`id: "${id}"`);
    if (kitStart === -1) continue;
    const anchor = next.indexOf("    source:", kitStart);
    if (anchor === -1) continue;
    const existing = /^ {4}screenshot: "[^"]*",\n/m.exec(next.slice(kitStart, anchor));
    if (existing) {
      next = next.slice(0, kitStart) + next.slice(kitStart).replace(existing[0], line);
    } else {
      next = next.slice(0, anchor) + line + next.slice(anchor);
    }
  }
  return next;
}

async function main() {
  const args = process.argv.slice(2);
  const keep = args.includes("--keep");
  const wanted = args.filter((a) => !a.startsWith("--"));

  const source = fs.readFileSync(SOURCE, "utf8");
  const cli = readPinnedCli(source);
  const all = readKits(source);
  if (!cli || all.length === 0) {
    console.error(`Read no kits (or no pinned CLI) from ${SOURCE}. Refusing to report success.`);
    process.exit(1);
  }

  const kits = wanted.length > 0 ? all.filter((k) => wanted.includes(k.id)) : all;
  if (kits.length === 0) {
    console.error(`No kit matched "${wanted.join(", ")}". Known: ${all.map((k) => k.id).join(", ")}`);
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("Playwright is missing. Run these two, then re-run this:");
    console.error("  pnpm add -Dw playwright");
    console.error("  pnpm exec playwright install chromium");
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "airrow-ui-kits-"));
  console.log(`Pinned CLI: ${cli}`);
  console.log(`Scratch:    ${scratch}\n`);

  const captured = {};
  const browser = await chromium.launch();

  try {
    for (const [i, kit] of kits.entries()) {
      console.log(`── ${kit.name} (${kit.id}) ──`);
      const app = path.join(scratch, kit.id);
      const port = 3210 + i;

      run("npx", ["--yes", "create-next-app@latest", app, "--ts", "--tailwind", "--eslint",
        "--app", "--no-src-dir", "--import-alias", "@/*", "--use-npm", "--yes"], scratch);
      // The same flags `/start` tells a founder to run — see `designSystemStep`. `--yes` alone is
      // not non-interactive: `init` also asks for a component library and a preset, and there is no
      // `--base-color` (that is a `components.json` field now).
      run("npx", ["--yes", cli, "init", "--yes", "-b", "radix", "-p", "nova"], app);

      const css = path.join(app, "app/globals.css");
      fs.appendFileSync(css, themeCss(kit));

      const dir = path.join(app, "app/specimen");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "page.tsx"), specimenPage(kit));

      // The real mark, for whichever direction leads with it. Copied rather than redrawn: the
      // approved artwork is a raster with no vector original, and a traced path would be a
      // different logo.
      const markTo = path.join(app, "public", MARK_SRC);
      fs.mkdirSync(path.dirname(markTo), { recursive: true });
      fs.copyFileSync(path.join(ROOT, "apps/web/public", MARK_SRC), markTo);
      console.log(`  wrote theme + specimen`);

      console.log(`  starting dev server on :${port}`);
      const proc = spawn("npx", ["next", "dev", "-p", String(port)], {
        cwd: app,
        stdio: "ignore",
        shell: process.platform === "win32",
        detached: process.platform !== "win32"
      });

      try {
        const url = `http://127.0.0.1:${port}${CAPTURE_ROUTE}`;
        await waitForServer(url, proc);

        const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 2 });
        if (kit.darkFirst) {
          await page.emulateMedia({ colorScheme: "dark" });
          await page.addInitScript(() => document.documentElement.classList.add("dark"));
        }
        await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
        // The dev overlay is our tooling, not the founder's design.
        await page.addStyleTag({ content: "nextjs-portal,#__next-build-watcher{display:none!important}" });
        await page.waitForTimeout(1000);

        const file = `${kit.id}.jpg`;
        await page.screenshot({ path: path.join(OUT_DIR, file), type: "jpeg", quality: 88 });
        await page.close();

        const kb = Math.round(fs.statSync(path.join(OUT_DIR, file)).size / 1024);
        console.log(`  ✓ ${file} (${kb} KB)\n`);
        captured[kit.id] = file;
      } finally {
        stopServer(proc);
      }
    }
  } finally {
    await browser.close();
    if (!keep) fs.rmSync(scratch, { recursive: true, force: true });
    else console.log(`Scratch apps kept at ${scratch}`);
  }

  if (Object.keys(captured).length > 0) {
    fs.writeFileSync(SOURCE, withScreenshots(fs.readFileSync(SOURCE, "utf8"), captured));
    console.log(`Pointed ${Object.keys(captured).length} kit(s) at their capture in ui-kits.ts.`);
    console.log("Review the images, run `pnpm -r test`, and commit both.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
