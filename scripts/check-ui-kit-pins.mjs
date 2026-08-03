// Compares the version each curated design direction is pinned to against the npm registry, and
// reports what has moved (spec 165). Reports only — bumping is a product decision, because the pinned
// version is named in every foundation's UI_ARCHITECTURE.md and changing it changes generated output.
//
// Reads the pins out of the source rather than importing it: this runs from `scripts/`, outside the
// workspace, with no build step and no dependency on the packages being installed.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "packages/schemas/src/ui-kits.ts");

/**
 * The `pkg`/`version` pairs declared in `ui-kits.ts`.
 *
 * A regex over the source, deliberately: the alternative is compiling TypeScript in a workflow whose
 * whole job is to read two strings. It is paired with a "found nothing" failure below, so the day the
 * shape changes this reports a broken check rather than a clean bill of health.
 */
export function readPins(source) {
  const pins = [];
  const re = /pkg:\s*"([^"]+)",\s*\n\s*version:\s*"([^"]+)"/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    pins.push({ pkg: match[1], version: match[2] });
  }
  return pins;
}

/** Newest first, by semver, with anything unparseable sorting last rather than throwing. */
export function isBehind(pinned, latest) {
  const parse = (v) => v.split(".").map((n) => Number.parseInt(n, 10));
  const [a, b] = [parse(pinned), parse(latest)];
  if (a.some(Number.isNaN) || b.some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i++) {
    if ((b[i] ?? 0) > (a[i] ?? 0)) return true;
    if ((b[i] ?? 0) < (a[i] ?? 0)) return false;
  }
  return false;
}

async function latestVersion(pkg) {
  const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
  if (!res.ok) throw new Error(`registry said ${res.status} for ${pkg}`);
  const body = await res.json();
  return { version: body.version, licence: body.license };
}

function output(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  // Heredoc form, so a multi-line report cannot break out of the key=value shape.
  const delimiter = `ghadelim_${Math.random().toString(36).slice(2)}`;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

async function main() {
  const pins = readPins(fs.readFileSync(SOURCE, "utf8"));
  if (pins.length === 0) {
    console.error(`No pins found in ${SOURCE} — the check cannot vouch for anything.`);
    process.exit(1);
  }

  const behind = [];
  for (const pin of pins) {
    const latest = await latestVersion(pin.pkg);
    const stale = isBehind(pin.version, latest.version);
    console.log(`${pin.pkg}: pinned ${pin.version}, latest ${latest.version}${stale ? "  ← behind" : ""}`);
    if (stale) behind.push({ ...pin, latest: latest.version, licence: latest.licence });
  }

  output("stale", behind.length > 0 ? "true" : "false");
  if (behind.length === 0) return;

  output(
    "report",
    [
      "The curated UI directions are pinned to a version upstream has moved past.",
      "",
      ...behind.map((b) => `- \`${b.pkg}\`: pinned **${b.version}**, latest **${b.latest}** (licence: ${b.licence})`),
      "",
      "Bumping is a product decision, not a chore: the pinned version is named in every generated",
      "`UI_ARCHITECTURE.md`, and changing it changes generated output. Run `/start` against the new",
      "version by hand before moving the pin, and check the licence has not changed with it."
    ].join("\n")
  );
}

// Importable for the tests in `scripts/`, which exercise the two pure functions without the network.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
