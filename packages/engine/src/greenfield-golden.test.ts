// The greenfield foundation, byte for byte (spec 212).
//
// Spec 212 gives every document a second phrasing for an imported project. The one thing that must
// not happen is the new branch leaking into the path that already worked: a founder starting from
// nothing gets exactly the foundation they got before, to the byte.
//
// The fixture holds a SHA-256 per delivered file rather than the files themselves. A hash proves
// byte-identity as strictly as the content would, and the diff a reviewer sees is the list of paths
// that changed — which is the question ("did greenfield move?"), not a wall of prose. When a change
// to the greenfield output is *intended*, the fixture is regenerated deliberately and the diff is
// reviewed like any other product decision (constitution §V).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { generate } from "./index.ts";
import { resolveProjectModel } from "./model.ts";
import type { TemplateFile } from "./scaffold.ts";
import type { InterviewAnswers } from "../../schemas/src/types.ts";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.resolve(HERE, "../../..", "template");
const FIXTURE = path.join(HERE, "__fixtures__", "greenfield-golden.json");

/**
 * Line endings are normalised on the way in, and that is what makes this fixture portable.
 *
 * `core.autocrlf` is on for Windows checkouts, so `template/**` is CRLF on a developer's disk and LF
 * in the repository and on CI. Hashing what is literally on disk would produce a fixture that only
 * matches the machine that captured it. What the founder is delivered comes from a Linux build, so LF
 * is both the honest baseline and the stable one.
 */
function loadTemplate(): TemplateFile[] {
  const files: TemplateFile[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        const rel = path.relative(TEMPLATE_DIR, abs).split(path.sep).join("/");
        if (rel === ".airrow-template.json") continue;
        files.push({ path: rel, content: fs.readFileSync(abs, "utf8").replace(/\r\n/g, "\n") });
      }
    }
  };
  walk(TEMPLATE_DIR);
  return files;
}

/**
 * The answers the fixture was captured from. Changing any of them invalidates it, so they are
 * spelled out here rather than shared with another test file that might drift.
 */
const ANSWERS: InterviewAnswers = {
  productType: "saas",
  problem: "Agencies lose follow-ups in three different inboxes.",
  vision: "The system of record every agency runs on.",
  mvpFocus: "Log a client and never miss a follow-up.",
  coreEntities: "Agencies own Clients; a Client has many Follow-ups.",
  tenancy: "organizations",
  authModel: ["email_password"],
  capabilities: ["auth", "organizations", "payments"],
  dataSensitivity: "standard",
  scale: "validate",
  framework: "nextjs",
  database: "supabase",
  hosting: "vercel",
  repoProvider: "github",
  team: "solo",
  uiDirection: "Calm, dense, keyboard-first."
};

interface Golden {
  files: Record<string, string>;
  count: number;
}

const sha256 = (s: string): string => crypto.createHash("sha256").update(s, "utf8").digest("hex");

describe("a project that began from nothing", () => {
  const golden: Golden = JSON.parse(fs.readFileSync(FIXTURE, "utf8"));
  const files = generate(
    loadTemplate(),
    resolveProjectModel({
      name: "Loop CRM",
      description: "A lightweight CRM for small agencies.",
      answers: ANSWERS,
      origin: { kind: "new" }
    })
  ).files;

  it("delivers exactly the files it delivered before spec 212", () => {
    expect(files.map((f) => f.path).sort()).toEqual(Object.keys(golden.files).sort());
    expect(files).toHaveLength(golden.count);
  });

  it("delivers every one of them byte for byte", () => {
    // Reported as a list of paths rather than one failing hash at a time: when this breaks, the
    // useful question is which documents moved, and a per-file expect would answer it one run at a
    // time.
    const changed = files.filter((f) => golden.files[f.path] !== sha256(f.content)).map((f) => f.path);
    expect(changed).toEqual([]);
  });
});
