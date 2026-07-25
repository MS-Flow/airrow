// Tests for the interview → ProjectModel resolution (issue #6): the architecture-first answers must
// project correctly. What the resolved model does to generated output is covered in scaffold.test.ts.
import { describe, it, expect } from "vitest";
import { resolveProjectModel } from "./model.ts";
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

  it("keeps the raw dataSensitivity answer alongside the coarse security level", () => {
    const m = resolveProjectModel(base);
    expect(m.dataSensitivity).toBe("pii");
    expect(m.security).toBe("elevated");
    const standard = resolveProjectModel({ ...base, answers: { ...base.answers, dataSensitivity: "standard" } });
    expect(standard.dataSensitivity).toBe("standard");
    expect(standard.security).toBe("standard");
    const regulated = resolveProjectModel({ ...base, answers: { ...base.answers, dataSensitivity: "regulated" } });
    expect(regulated.dataSensitivity).toBe("regulated");
    expect(regulated.security).toBe("elevated");
  });

  it("records aiUsage only when AI is a selected capability", () => {
    expect(resolveProjectModel(base).aiUsage).toBe("rag");
    const noAi = resolveProjectModel({ ...base, answers: { ...base.answers, capabilities: ["payments"], aiUsage: undefined } });
    expect(noAi.aiUsage).toBe("none");
    expect(noAi.derived.hasAi).toBe(false);
  });

  it("drops the AI capability when the founder answers \"no AI after all\"", () => {
    const m = resolveProjectModel({ ...base, answers: { ...base.answers, aiUsage: "none" } });
    expect(m.derived.hasAi).toBe(false);
    expect(m.features).not.toContain("ai");
    expect(m.features).toContain("payments"); // the other capabilities survive
    expect(m.aiUsage).toBe("none");
  });

  it("never guesses the kind of AI when the founder skipped it", () => {
    const m = resolveProjectModel({ ...base, answers: { ...base.answers, aiUsage: undefined } });
    expect(m.derived.hasAi).toBe(true);
    expect(m.aiUsage).toBe("none"); // flagged downstream, not invented
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
