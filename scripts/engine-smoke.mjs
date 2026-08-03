// Engine smoke test (F-101 AC-4). Run: node --experimental-strip-types scripts/engine-smoke.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateFromInput, shipsPath } from "../packages/engine/src/index.ts";

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
      vision: "Let an agency log clients and never miss a follow-up. Long-term, the system of record every independent agency runs its client relationships on.",
      audience: "b2b",
      coreEntities: "Agencies own Clients; a Client has many Deals and Follow-ups.",
      tenancy: "organizations",
      authModel: ["email_password", "social"],
      roles: "simple",
      capabilities: ["payments", "email", "search", "ai", "audit_logs"],
      aiUsage: "rag",
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
      vision: "A buyer can find a plant nearby and complete a purchase. Long-term, the go-to marketplace for rare houseplants, trusted for safe local trades.",
      audience: "b2c",
      coreEntities: "Sellers list Plants; a Buyer places an Order for a Plant.",
      tenancy: "marketplace",
      authModel: ["email_password", "magic_link"],
      roles: "simple",
      capabilities: ["payments", "storage", "search", "notifications", "realtime"],
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
      vision: "Ops can approve or reject a vendor request with an audit trail. Long-term, one console where operations runs every vendor decision with a full audit trail.",
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
      vision: "Turn a recorded visit into a reviewable draft note. Long-term, every small practice ends the day with notes already written.",
      audience: "b2b",
      coreEntities: "Practices employ Clinicians; a Clinician records Visits; each Visit yields a Note.",
      tenancy: "organizations",
      authModel: ["sso", "email_password"],
      roles: "granular",
      capabilities: ["ai", "storage", "audit_logs", "admin"],
      aiUsage: "agents",
      dataSensitivity: "regulated",
      scale: "growth",
      framework: "nextjs",
      database: "postgres",
      hosting: "self_host",
      repoProvider: "github",
      team: "small_team"
    }
  },
  {
    // Spec 91: a project that already exists. Same pipeline, same model — one field different, and
    // the foundation it gets has to be the one that fits a repository with code already in it.
    name: "Ledgerly",
    description: "An invoicing tool a freelance developer has been running for two years.",
    origin: { kind: "imported", stackDetected: true },
    answers: {
      productType: "saas",
      vision: "Send an invoice and know when it was paid. Long-term, the invoicing tool freelancers never have to think about.",
      audience: "b2b",
      coreEntities: "A Freelancer bills Clients; a Client receives Invoices; an Invoice has Payments.",
      tenancy: "single_user",
      authModel: ["email_password"],
      capabilities: ["payments", "email"],
      dataSensitivity: "pii",
      scale: "validate",
      framework: "nextjs",
      database: "supabase",
      hosting: "vercel",
      repoProvider: "github",
      team: "solo"
    }
  },
  {
    // Spec 187: the same import, delivered hidden. Everything lands under one folder git is told to
    // ignore, and no pipeline ships — a workflow in an ignored folder could never run. The point of
    // the fixture is that nothing else about the foundation changes.
    name: "Keystone Ops",
    description: "An internal operations dashboard a developer wants to bring Airrow into quietly.",
    origin: {
      kind: "imported",
      stackDetected: true,
      delivery: { kind: "hidden", folder: "notes" }
    },
    answers: {
      productType: "internal_tool",
      vision: "See every overnight job in one place. Long-term, nobody opens a terminal to find out what broke.",
      audience: "internal",
      coreEntities: "A Team owns Services; a Service runs Jobs; a Job produces Runs.",
      tenancy: "internal",
      authModel: ["sso"],
      capabilities: ["admin"],
      dataSensitivity: "standard",
      scale: "validate",
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

  // Spec 187: a hidden delivery moves the whole foundation under one folder, so every path below is
  // asked for through the layout rather than assumed to sit at the root.
  const folder =
    fx.origin?.kind === "imported" && fx.origin.delivery?.kind === "hidden"
      ? fx.origin.delivery.folder
      : null;
  const at = (p) => (folder === null ? p : `${folder}/${p}`);
  if (folder !== null) {
    const escaped = files.filter((f) => !f.path.startsWith(`${folder}/`));
    if (escaped.length > 0) fail(`${escaped.length} file(s) delivered outside ${folder}/`);
  }

  // Not every template file ships in every project: GitHub Actions and Azure Pipelines are
  // alternatives, so each project gets one set and never the other.
  const expected = TEMPLATE.filter((f) => shipsPath(model, f.path)).length;
  if (files.length !== expected) fail(`expected ${expected} files, got ${files.length}`);
  if (manifest.fileCount !== files.length) fail("manifest count mismatch");

  for (const f of files) {
    if (f.content.trim().length < 40) fail(`short file: ${f.path}`);
    if (/\{\{[A-Z0-9_]+\}\}|\bundefined\b\n/.test(f.content)) fail(`unresolved content: ${f.path}`);
  }

  // The onboarding path and the vision must always ship.
  for (const required of ["START_HERE.md", "docs/VISION.md", "specs/README.md"]) {
    if (!paths.has(at(required))) fail(`missing required file: ${at(required)}`);
  }

  // Personalization: the answers, not a template, drive the content.
  const readme = files.find((f) => f.path === at("README.md"));
  if (!readme?.content.includes(fx.name)) fail("README not personalized with project name");
  const vision = files.find((f) => f.path === at("docs/VISION.md"));
  if (!vision?.content.includes(fx.answers.vision)) fail("VISION.md missing the long-term vision");
  

  // Spec 91: exactly one first-run command, and it is the one this project's origin calls for. Both
  // would be worse than neither — one of them would be wrong about the repository it is sitting in.
  const imported = fx.origin?.kind === "imported" && fx.origin.stackDetected;
  const expectedCommand = at(`.claude/commands/${imported ? "cleanup" : "start"}.md`);
  const wrongCommand = at(`.claude/commands/${imported ? "start" : "cleanup"}.md`);
  if (!paths.has(expectedCommand)) fail(`missing first-run command: ${expectedCommand}`);
  if (paths.has(wrongCommand)) fail(`ships the wrong first-run command: ${wrongCommand}`);
  if (text.includes(imported ? "/start" : "/cleanup")) {
    fail(`documents name /${imported ? "start" : "cleanup"}, which this foundation does not ship`);
  }

  // Spec 157: /security has no alternative to pair it with — a project started from nothing and one
  // that arrived with years of code both have holes to find, so every foundation ships it.
  if (!paths.has(at(".claude/commands/security.md"))) fail("missing /security command");

  // Spec 66: the commands the documents tell the founder to run have to be the ones `/start` sets
  // up. A foundation whose START_HERE names `pnpm test` while `/start` wires `npm test` is the same
  // broken first experience as having no commands at all, just harder to spot.
  const start = files.find((f) => f.path === at(".claude/commands/start.md"))?.content ?? "";
  if (!imported && !start) fail("missing /start command");
  const run = fx.answers.framework === "vite" ? "npm run" : "pnpm";
  const here = files.find((f) => f.path === at("START_HERE.md"))?.content ?? "";
  const azure = fx.answers.repoProvider === "azure_devops";
  const ciPath = azure ? "azure-pipelines.yml" : ".github/workflows/ci.yml";
  const ci = files.find((f) => f.path === ciPath)?.content ?? "";
  // Spec 187: a hidden foundation ships no pipeline at all — one inside an ignored folder is never
  // pushed and never runs, so shipping it would be a check that only looks like it is happening.
  if (folder === null && !ci) fail(`missing CI definition: ${ciPath}`);
  if (folder !== null && ci) fail("a hidden foundation must ship no CI definition");
  for (const script of ["dev", "typecheck", "lint", "test"]) {
    const command = `${run} ${script}`;
    // Only /start wires the toolchain; /cleanup measures the one that is already there.
    if (!imported && !start.includes(command)) fail(`/start does not set up \`${command}\``);
    if (!here.includes(command)) fail(`START_HERE.md does not name \`${command}\``);
  }
  if (folder === null) {
    for (const script of ["typecheck", "lint", "test"]) {
      if (!ci.includes(`${run} ${script}`)) fail(`${ciPath} does not run \`${run} ${script}\``);
    }
    const gate = azure ? "dependencies.detect.outputs" : "needs.detect.outputs.ready";
    if (!ci.includes(gate)) fail(`${ciPath} is not gated on there being a stack to verify`);
  }
  // A foundation must never describe someone else's tooling.
  if (azure && text.includes("GitHub")) fail("GitHub named in an Azure DevOps project");
  if (!azure && text.includes("Azure DevOps")) fail("Azure DevOps named in a GitHub project");

  // No ADR leftovers, and no stack contradictions.
  if (text.includes("ADR")) fail("ADR reference in generated output");
  if (fx.answers.hosting !== "vercel" && text.includes("Vercel")) fail("Vercel named for a non-Vercel host");
  if (fx.answers.database !== "supabase" && text.includes("Supabase")) fail("Supabase named for a non-Supabase project");

  // Exactly one spec brief per selected capability — no more, no fewer.
  const specs = files.find((f) => f.path === at("specs/README.md"))?.content ?? "";
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
