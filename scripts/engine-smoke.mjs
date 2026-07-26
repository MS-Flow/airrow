// Engine smoke test (F-101 AC-4). Run: node --experimental-strip-types scripts/engine-smoke.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateFromInput } from "../packages/engine/src/index.ts";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATE_DIR = path.join(REPO_ROOT, "template");

/** Read the canonical template the way the app does, excluding the meta file. */
function loadTemplate() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else {
        const rel = path.relative(TEMPLATE_DIR, abs).split(path.sep).join("/");
        if (rel === ".airrow-template.json") continue;
        files.push({ path: rel, content: fs.readFileSync(abs, "utf8") });
      }
    }
  };
  walk(TEMPLATE_DIR);
  return files;
}

const TEMPLATE = loadTemplate();

const fixtures = [
  {
    name: "Loop CRM",
    description: "A lightweight CRM that helps small agencies track client relationships and follow-ups.",
    answers: {
      productType: "saas",
      vision: "The system of record every independent agency runs its client relationships on.",
      mvpFocus: "Let an agency log clients and never miss a follow-up.",
      audience: "b2b",
      coreEntities: "Agencies own Clients; a Client has many Deals and Follow-ups.",
      tenancy: "organizations",
      authModel: ["email_password", "social"],
      roles: "simple",
      capabilities: ["payments", "email", "search", "ai", "audit_logs"],
      aiUsage: "rag",
      integrations: "Stripe for billing, Resend for email.",
      dataSensitivity: "pii",
      scale: "validate",
      framework: "nextjs",
      database: "supabase",
      hosting: "vercel",
      repoProvider: "github",
      team: "small_team"
    }
  },
  {
    name: "Plantswap",
    description: "A marketplace where plant lovers buy, sell, and trade rare houseplants locally.",
    answers: {
      productType: "marketplace",
      vision: "The go-to marketplace for rare houseplants, trusted for safe local trades.",
      mvpFocus: "A buyer can find a plant nearby and complete a purchase.",
      audience: "b2c",
      coreEntities: "Sellers list Plants; a Buyer places an Order for a Plant.",
      tenancy: "marketplace",
      authModel: ["email_password", "magic_link"],
      roles: "simple",
      capabilities: ["payments", "storage", "search", "notifications", "realtime"],
      integrations: "Stripe Connect for seller payouts.",
      dataSensitivity: "standard",
      scale: "growth",
      framework: "nextjs",
      database: "supabase",
      hosting: "vercel",
      repoProvider: "github",
      team: "solo"
    }
  },
  {
    name: "Ops Console",
    description: "An internal tool for the operations team to review and approve vendor requests.",
    answers: {
      productType: "internal_tool",
      vision: "One console where operations runs every vendor decision with a full audit trail.",
      mvpFocus: "Ops can approve or reject a vendor request with an audit trail.",
      coreEntities: "Vendors submit Requests; an Operator reviews each Request and records a Decision.",
      tenancy: "internal",
      authModel: ["sso"],
      capabilities: ["admin", "audit_logs", "notifications"],
      dataSensitivity: "standard",
      scale: "high_scale",
      framework: "vite",
      database: "postgres",
      hosting: "azure",
      repoProvider: "azure_devops",
      team: "startup"
    }
  },
  {
    // Issue #10: multi-tenant + AI + non-Vercel + non-Supabase, the combination most likely to
    // produce a self-contradicting foundation.
    name: "Chartwise",
    description: "A clinical documentation assistant that drafts visit notes for small practices.",
    answers: {
      productType: "ai_agent",
      vision: "Every small practice ends the day with notes already written.",
      mvpFocus: "Turn a recorded visit into a reviewable draft note.",
      audience: "b2b",
      coreEntities: "Practices employ Clinicians; a Clinician records Visits; each Visit yields a Note.",
      tenancy: "organizations",
      authModel: ["sso", "email_password"],
      roles: "granular",
      capabilities: ["ai", "storage", "audit_logs", "admin"],
      aiUsage: "agents",
      integrations: "Whisper for transcription, an EHR export endpoint.",
      dataSensitivity: "regulated",
      scale: "growth",
      framework: "nextjs",
      database: "postgres",
      hosting: "self_host",
      repoProvider: "github",
      team: "small_team"
    }
  }
];

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error("  ✗ " + msg);
};

for (const fx of fixtures) {
  console.log(`\nFixture: ${fx.name}`);
  const { model, result } = generateFromInput(TEMPLATE, fx);
  const { files, manifest } = result;
  const paths = new Set(files.map((f) => f.path));
  const text = files.map((f) => f.content).join("\n");

  if (files.length !== TEMPLATE.length) fail(`expected ${TEMPLATE.length} files, got ${files.length}`);
  if (manifest.fileCount !== files.length) fail("manifest count mismatch");

  for (const f of files) {
    if (f.content.trim().length < 40) fail(`short file: ${f.path}`);
    if (/\{\{[A-Z0-9_]+\}\}|\bundefined\b\n/.test(f.content)) fail(`unresolved content: ${f.path}`);
  }

  // The onboarding path and the vision must always ship.
  for (const required of ["START_HERE.md", "docs/VISION.md", "specs/README.md"]) {
    if (!paths.has(required)) fail(`missing required file: ${required}`);
  }

  // Personalization: the answers, not a template, drive the content.
  const readme = files.find((f) => f.path === "README.md");
  if (!readme?.content.includes(fx.name)) fail("README not personalized with project name");
  const vision = files.find((f) => f.path === "docs/VISION.md");
  if (!vision?.content.includes(fx.answers.vision)) fail("VISION.md missing the long-term vision");
  if (!vision?.content.includes(fx.answers.mvpFocus)) fail("VISION.md missing the MVP focus");

  // No ADR leftovers, and no stack contradictions.
  if (text.includes("ADR")) fail("ADR reference in generated output");
  if (fx.answers.hosting !== "vercel" && text.includes("Vercel")) fail("Vercel named for a non-Vercel host");
  if (fx.answers.database !== "supabase" && text.includes("Supabase")) fail("Supabase named for a non-Supabase project");

  // Exactly one spec brief per selected capability — no more, no fewer.
  const specs = files.find((f) => f.path === "specs/README.md")?.content ?? "";
  const briefs = (specs.match(/^### /gm) ?? []).length;
  if (briefs !== model.features.length) {
    fail(`expected ${model.features.length} capability briefs, got ${briefs}`);
  }
  if (!model.derived.hasAi && specs.includes("retrieval-augmented")) fail("AI brief present without AI selected");

  console.log(`  ✓ ${files.length} files, manifest ok, personalization ok (slug: ${model.slug})`);
}

// Different models must produce different content — proof the answers actually drive the output.
{
  const [a, b] = [fixtures[0], fixtures[3]];
  const pick = (fx) =>
    generateFromInput(TEMPLATE, fx).result.files.find((f) => f.path === "docs/architecture/SYSTEM_OVERVIEW.md");
  if (pick(a).content === pick(b).content) fail("system overviews identical across different models");
  else console.log("\n✓ Distinct models produce distinct architecture content");
}

if (failures > 0) {
  console.error(`\nSMOKE FAILED: ${failures} issue(s)`);
  process.exit(1);
}
console.log("\nSMOKE PASSED");
