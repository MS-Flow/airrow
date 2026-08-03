// Tests for the interview → ProjectModel resolution (issue #6): the architecture-first answers must
// project correctly. What the resolved model does to generated output is covered in scaffold.test.ts.
import { describe, it, expect } from "vitest";
import { resolveProjectModel } from "./model.ts";
import type { ResolveInput } from "./model.ts";
import { KEEP_EXISTING_UI, UI_KITS } from "../../schemas/src/ui-kits.ts";

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

  // A mobile app used to resolve to Vite + React, which is a web SPA — the founder downloaded a
  // foundation for a product they were not building and only found out from `npm run dev`.
  it("resolves an unanswered stack to the standard one for that product type, never a web SPA", () => {
    const mobile = resolveProjectModel({
      ...base,
      answers: { ...base.answers, productType: "mobile_app", framework: undefined }
    });
    expect(mobile.stack.framework).toBe("custom");
    expect(mobile.stack.customFramework).toMatch(/Expo/);

    const saas = resolveProjectModel({ ...base, answers: { ...base.answers, framework: undefined } });
    expect(saas.stack.framework).toBe("nextjs");
    expect(saas.stack.customFramework).toBe("");
  });

  it("keeps the stack the founder chose over the one their product type suggests", () => {
    const m = resolveProjectModel({
      ...base,
      answers: { ...base.answers, productType: "mobile_app", framework: "nextjs" }
    });
    expect(m.stack.framework).toBe("nextjs");
  });

  it("keeps a described stack the founder wrote themselves", () => {
    const m = resolveProjectModel({
      ...base,
      answers: {
        ...base.answers,
        productType: "mobile_app",
        framework: "custom",
        frameworkOther: "Flutter with Dart 3 and melos."
      }
    });
    expect(m.stack.customFramework).toBe("Flutter with Dart 3 and melos.");
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

/**
 * Spec 199. An imported project may answer the design question — including with the answer that its
 * look is already there — and none of those answers may become an install.
 *
 * The rule predates this spec (`model.ts` nulls the kit for an imported project), but the spec added
 * a new value to that field, and a new value is exactly how a rule like this gets bypassed by
 * accident. So it is asserted rather than assumed.
 */
describe("what an imported project's design answer installs", () => {
  const imported: ResolveInput = {
    ...base,
    origin: { kind: "imported", stackDetected: true, delivery: { kind: "integrated" } }
  };

  it("installs nothing when the founder keeps the look that is already there", () => {
    const model = resolveProjectModel({
      ...imported,
      answers: { ...base.answers, uiKit: KEEP_EXISTING_UI }
    });
    expect(model.uiKit).toBeNull();
  });

  it("installs nothing even when the founder picks a curated direction", () => {
    // Picking one describes a look in `UI_ARCHITECTURE.md`; it never adds a dependency to a codebase
    // `/cleanup` is forbidden from changing.
    const model = resolveProjectModel({
      ...imported,
      answers: { ...base.answers, uiKit: UI_KITS[0]!.id }
    });
    expect(model.uiKit).toBeNull();
  });

  it("still installs for a project that is starting from nothing", () => {
    // The other half of the assertion: the rule is about imports, not about the answer.
    const model = resolveProjectModel({
      ...base,
      answers: { ...base.answers, uiKit: UI_KITS[0]!.id }
    });
    expect(model.uiKit?.id).toBe(UI_KITS[0]!.id);
  });
});
