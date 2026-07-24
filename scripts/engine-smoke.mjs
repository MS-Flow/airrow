// Engine smoke test (F-101 AC-4). Run: node --experimental-strip-types scripts/engine-smoke.mjs
import { generateFromInput } from "../packages/engine/src/index.ts";

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
