// Tests for the redesigned interview → ProjectModel resolution (issue #6):
// the architecture-first answers must project correctly and change generated output.
import { describe, it, expect } from "vitest";
import { resolveProjectModel } from "./model.ts";
import { generateFromInput } from "./index.ts";
import type { ResolveInput } from "./model.ts";

const base: ResolveInput = {
  name: "Loop CRM",
  description: "A CRM for small agencies.",
  answers: {
    productType: "saas",
    vision: "The system of record every agency runs on.",
    mvpFocus: "Log clients and never miss a follow-up.",
    audience: "b2b",
    tenancy: "organizations",
    authModel: ["email_password", "social"],
    roles: "simple",
    capabilities: ["payments", "ai"],
    aiUsage: "rag",
    integrations: "Stripe for billing.",
    dataSensitivity: "pii",
    scale: "growth",
    framework: "nextjs",
    database: "supabase",
    hosting: "vercel",
    repoProvider: "github",
    team: "small_team"
  }
};

describe("resolveProjectModel — capability & identity projection", () => {
  it("derives auth + organizations features from authModel and tenancy", () => {
    const m = resolveProjectModel(base);
    expect(m.features).toContain("auth"); // from a non-public authModel
    expect(m.features).toContain("organizations"); // from multi-tenant tenancy
    expect(m.features).toContain("payments"); // selected capability
    expect(m.derived.multiTenant).toBe(true);
    expect(m.roles).toBe("simple");
  });

  it("maps dataSensitivity to the security level", () => {
    expect(resolveProjectModel(base).security).toBe("elevated"); // pii → elevated
    const standard = resolveProjectModel({ ...base, answers: { ...base.answers, dataSensitivity: "standard" } });
    expect(standard.security).toBe("standard");
  });

  it("records aiUsage only when AI is a selected capability", () => {
    expect(resolveProjectModel(base).aiUsage).toBe("rag");
    const noAi = resolveProjectModel({ ...base, answers: { ...base.answers, capabilities: ["payments"], aiUsage: undefined } });
    expect(noAi.aiUsage).toBe("none");
    expect(noAi.derived.hasAi).toBe(false);
  });

  it("defaults a hobby / for-fun project to a consumer audience", () => {
    const m = resolveProjectModel({
      ...base,
      answers: { ...base.answers, productType: "hobby", audience: undefined }
    });
    expect(m.productType).toBe("hobby");
    expect(m.audience).toBe("b2c");
  });

  it("treats a public-only authModel as no accounts", () => {
    const m = resolveProjectModel({
      ...base,
      answers: { ...base.answers, tenancy: "single_user", authModel: ["public"] }
    });
    expect(m.derived.needsAuth).toBe(false);
    expect(m.features).not.toContain("auth");
    expect(m.derived.multiTenant).toBe(false);
    expect(m.roles).toBe("none");
  });
});

describe("generated output reflects the new answers", () => {
  const files = generateFromInput(base).result.files;
  const byPath = (p: string) => files.find((f) => f.path === p)?.content ?? "";

  it("threads the long-term vision into VISION.md and CLAUDE.md", () => {
    expect(byPath("docs/VISION.md")).toContain(base.answers.vision);
    expect(byPath("CLAUDE.md")).toContain(base.answers.vision);
  });

  it("names the chosen auth methods in the auth spec", () => {
    expect(byPath("specs/mvp/auth.md")).toContain("email & password");
    expect(byPath("specs/mvp/auth.md")).toContain("social login");
  });

  it("generates a spec for every selected capability", () => {
    expect(byPath("specs/mvp/payments.md")).not.toBe("");
    expect(byPath("specs/mvp/ai.md")).not.toBe("");
  });
});

describe("framework threads consistently", () => {
  const gen = (framework: "nextjs" | "vite") =>
    generateFromInput({ ...base, answers: { ...base.answers, framework } }).result.files;
  const find = (files: ReturnType<typeof gen>, p: string) => files.find((f) => f.path === p)?.content ?? "";

  it("renders Next.js as a server framework", () => {
    expect(find(gen("nextjs"), "docs/architecture/ARCHITECTURE.md")).toContain("Next.js");
    expect(find(gen("nextjs"), "docs/architecture/ARCHITECTURE.md")).not.toContain("Vite + React SPA");
  });

  it("treats Vite as an SPA", () => {
    expect(find(gen("vite"), "docs/architecture/ARCHITECTURE.md")).toContain("Vite + React SPA");
  });
});

describe("database provider threads consistently", () => {
  const gen = (database: "supabase" | "postgres") =>
    generateFromInput({ ...base, answers: { ...base.answers, database } }).result.files;
  const find = (files: ReturnType<typeof gen>, p: string) => files.find((f) => f.path === p)?.content ?? "";

  it("keeps Supabase wording for the golden path", () => {
    expect(find(gen("supabase"), "README.md")).toContain("Supabase");
    expect(find(gen("supabase"), "docs/GETTING_STARTED.md")).toContain("Create the database");
  });

  it("names self-hosted Postgres and drops the Supabase project step", () => {
    const files = gen("postgres");
    expect(find(files, "docs/architecture/TECH_STACK.md")).toContain("PostgreSQL (self-hosted)");
    const gs = find(files, "docs/GETTING_STARTED.md");
    expect(gs).not.toContain("supabase.com → New project");
  });
});

describe("hosting threads consistently (no Vercel contradiction)", () => {
  const azure = generateFromInput({ ...base, answers: { ...base.answers, hosting: "azure" } }).result.files;
  const byPath = (p: string) => azure.find((f) => f.path === p)?.content ?? "";

  it("names the chosen host and does not hardcode Vercel in the README stack", () => {
    expect(byPath("README.md")).toContain("Azure");
    expect(byPath("README.md")).not.toContain("Vercel");
    expect(byPath("docs/architecture/TECH_STACK.md")).toContain("Azure");
    expect(byPath("docs/architecture/ARCHITECTURE.md")).toContain("Azure");
    expect(byPath("CLAUDE.md")).not.toContain("Vercel");
  });
});
