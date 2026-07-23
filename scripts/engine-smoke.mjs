// Engine smoke test (F-101 AC-4). Run: node --experimental-strip-types scripts/engine-smoke.mjs
import { generateFromInput } from "../packages/engine/src/index.ts";

const fixtures = [
  {
    name: "Loop CRM",
    description: "A lightweight CRM that helps small agencies track client relationships and follow-ups.",
    answers: {
      productType: "saas",
      audience: "b2b",
      features: ["auth", "organizations", "payments", "email", "search", "ai", "audit_logs"],
      roles: "simple",
      framework: "nextjs",
      repoProvider: "github",
      team: "small_team",
      security: "elevated",
      scale: "validate",
      mvpFocus: "Let an agency log clients and never miss a follow-up.",
      goal90: "15 paying agencies using it daily."
    }
  },
  {
    name: "Plantswap",
    description: "A marketplace where plant lovers buy, sell, and trade rare houseplants locally.",
    answers: {
      productType: "marketplace",
      audience: "b2c",
      features: ["auth", "payments", "storage", "search", "notifications", "realtime"],
      framework: "nextjs",
      repoProvider: "github",
      team: "solo",
      security: "standard",
      scale: "growth",
      mvpFocus: "A buyer can find a plant nearby and complete a purchase.",
      goal90: "500 completed transactions."
    }
  },
  {
    name: "Ops Console",
    description: "An internal tool for the operations team to review and approve vendor requests.",
    answers: {
      productType: "internal_tool",
      features: ["auth", "admin", "audit_logs", "notifications"],
      framework: "vite",
      repoProvider: "azure_devops",
      team: "startup",
      security: "standard",
      scale: "validate",
      mvpFocus: "Ops can approve or reject a vendor request with an audit trail.",
      goal90: "All vendor approvals moved out of email."
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
  const { model, result } = generateFromInput(fx);
  const { files, manifest } = result;
  const paths = new Set(files.map((f) => f.path));

  if (files.length < 25) fail(`expected ≥25 files, got ${files.length}`);
  if (manifest.fileCount !== files.length) fail("manifest count mismatch");

  for (const f of files) {
    if (f.content.trim().length < 40) fail(`short file: ${f.path}`);
    if (/\{\{|\bundefined\b\n/.test(f.content)) fail(`unresolved content: ${f.path}`);
  }

  // AC-2: feature specs exactly for selected (spec'd) features
  for (const feat of model.features) {
    if (feat === "roles") continue; // folded into organizations spec
    if (!paths.has(`specs/mvp/${feat}.md`)) fail(`missing feature spec: ${feat}`);
  }

  // AC-3 sanity: personalization present
  const readme = files.find((f) => f.path === "README.md");
  if (!readme?.content.includes(fx.name)) fail("README not personalized with project name");
  const vision = files.find((f) => f.path === "docs/VISION.md");
  if (!vision?.content.includes(fx.answers.mvpFocus)) fail("VISION missing MVP focus");

  console.log(`  ✓ ${files.length} files, manifest ok, personalization ok (slug: ${model.slug})`);
}

// AC-3: different models → different architecture content
{
  const [a, b] = [fixtures[0], fixtures[2]];
  const ra = generateFromInput(a).result.files.find((f) => f.path === "docs/architecture/ARCHITECTURE.md");
  const rb = generateFromInput(b).result.files.find((f) => f.path === "docs/architecture/ARCHITECTURE.md");
  if (ra.content === rb.content) fail("architecture docs identical across different models");
  else console.log("\n✓ Distinct models produce distinct architecture docs");
}

if (failures > 0) {
  console.error(`\nSMOKE FAILED: ${failures} issue(s)`);
  process.exit(1);
}
console.log("\nSMOKE PASSED");
