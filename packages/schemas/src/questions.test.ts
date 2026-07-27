// Tests for the interview schema's stack question and its per-product-type recommendation.
//
// The defect these exist to prevent is a silent one: a founder building a mobile app was never shown
// the stack question at all, and the engine resolved them to Vite + React — a web SPA, with
// `npm run dev` in every document. Nothing failed; the answer was simply never asked for.
import { describe, it, expect } from "vitest";
import {
  ANSWER_MAX_CHARS,
  STANDARD_STACK,
  interviewQuestions,
  isQuestionVisible,
  isRecommendedOption,
  suggestedValue,
  visibleQuestions,
  withSuggestions,
  type Question
} from "./questions.ts";
import type { InterviewAnswers, ProductType } from "./types.ts";

const PRODUCT_TYPES = Object.keys(STANDARD_STACK) as ProductType[];

function question(id: Question["id"]): Question {
  const q = interviewQuestions.find((x) => x.id === id);
  if (!q) throw new Error(`no question ${id}`);
  return q;
}

const framework = question("framework");

describe("every product type is asked which stack it is built in", () => {
  it("shows the stack question whatever the founder is building", () => {
    for (const productType of PRODUCT_TYPES) {
      expect(isQuestionVisible(framework, { productType })).toBe(true);
    }
  });

  it("reaches the stack question for a mobile app — the case that used to skip it", () => {
    const ids = visibleQuestions({ productType: "mobile_app" }).map((q) => q.id);
    expect(ids).toContain("framework");
  });
});

describe("the recommendation follows what the founder is building", () => {
  it("points web products at the golden path", () => {
    for (const productType of ["saas", "marketplace", "ai_agent", "internal_tool", "hobby"] as const) {
      expect(suggestedValue(framework, { productType })).toBe("nextjs");
    }
  });

  it("never points a mobile app, an API or an extension at a web SPA", () => {
    for (const productType of ["mobile_app", "api", "browser_extension"] as const) {
      const suggested = suggestedValue(framework, { productType });
      expect(suggested).toBe("custom");
      expect(suggested).not.toBe("vite");
    }
  });

  it("marks the recommended option per product type, not one fixed option", () => {
    const option = (value: string) => {
      const o = framework.options?.find((x) => x.value === value);
      if (!o) throw new Error(`no option ${value}`);
      return o;
    };
    const saas: InterviewAnswers = { productType: "saas" };
    const mobile: InterviewAnswers = { productType: "mobile_app" };
    expect(isRecommendedOption(framework, option("nextjs"), saas)).toBe(true);
    expect(isRecommendedOption(framework, option("custom"), saas)).toBe(false);
    expect(isRecommendedOption(framework, option("custom"), mobile)).toBe(true);
    expect(isRecommendedOption(framework, option("nextjs"), mobile)).toBe(false);
  });

  it("falls back to the option's own flag where the recommendation is the same for everyone", () => {
    const database = question("database");
    const supabase = database.options?.find((o) => o.value === "supabase");
    const postgres = database.options?.find((o) => o.value === "postgres");
    expect(supabase && isRecommendedOption(database, supabase, {})).toBe(true);
    expect(postgres && isRecommendedOption(database, postgres, {})).toBe(false);
  });

  it("says nothing until the answer it keys off has been given", () => {
    expect(suggestedValue(framework, {})).toBeNull();
    expect(suggestedValue(question("vision"), { productType: "saas" })).toBeNull();
  });
});

describe("the described stack is prefilled, not assumed", () => {
  it("prefills a standard description for the product types the engine cannot scaffold", () => {
    expect(withSuggestions({ productType: "mobile_app" }).frameworkOther).toMatch(/Expo/);
    expect(withSuggestions({ productType: "api" }).frameworkOther).toMatch(/Node/);
    expect(withSuggestions({ productType: "browser_extension" }).frameworkOther).toMatch(/CRXJS/);
  });

  it("leaves the field empty where the golden path already answers it", () => {
    expect(withSuggestions({ productType: "saas" }).frameworkOther).toBeUndefined();
  });

  it("never writes over what the founder typed", () => {
    const mine = "Flutter with Dart 3 and melos, flutter test for tests.";
    const next = withSuggestions({ productType: "mobile_app", frameworkOther: mine });
    expect(next.frameworkOther).toBe(mine);
  });

  it("keeps every prefill inside the ceiling the field and the schema enforce", () => {
    for (const stack of Object.values(STANDARD_STACK)) {
      if (!stack.describe) continue;
      expect(stack.describe.length).toBeLessThanOrEqual(ANSWER_MAX_CHARS.frameworkOther);
    }
  });

  // A prefill is only useful if it says the things the toolchain is derived from — the authoring
  // prompt asks for a language, a framework and a package manager, and gets what is in this field.
  it("names a package manager in every described stack", () => {
    for (const stack of Object.values(STANDARD_STACK)) {
      if (!stack.describe) continue;
      expect(stack.describe).toMatch(/npm|pnpm|yarn|uv|bun/);
    }
  });
});

describe("the table covers everything the interview can produce", () => {
  it("has an entry for every product type the question offers", () => {
    const offered = question("productType").options?.map((o) => o.value) ?? [];
    expect(offered.length).toBeGreaterThan(0);
    for (const value of offered) {
      expect(STANDARD_STACK[value as ProductType]).toBeDefined();
    }
  });

  it("describes the stack whenever it recommends one the engine cannot derive commands for", () => {
    for (const stack of Object.values(STANDARD_STACK)) {
      if (stack.framework === "custom") expect(stack.describe).toBeTruthy();
      else expect(stack.describe).toBeUndefined();
    }
  });
});
