// Tests for the interview schema's stack question and its per-product-type recommendation.
//
// The defect these exist to prevent is a silent one: a founder building a mobile app was never shown
// the stack question at all, and the engine resolved them to Vite + React — a web SPA, with
// `npm run dev` in every document. Nothing failed; the answer was simply never asked for.
import { describe, it, expect } from "vitest";
import {
  ANSWER_MAX_CHARS,
  MAX_UI_REFERENCE_LINKS,
  STANDARD_STACK,
  firstUnanswered,
  interviewQuestions,
  isQuestionVisible,
  isRecommendedOption,
  splitReferenceLinks,
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
    for (const [productType, stack] of Object.entries(STANDARD_STACK)) {
      // `other` is the one product type nothing here can describe a stack for, and that is its whole
      // meaning: the founder picked it because the list did not cover what they are building, so the
      // recommendation is `custom` with no prefill and they write the sentence themselves (spec 159).
      // Every *known* type that points at `custom` still owes one — a founder building a mobile app
      // should not have to know that Expo is the answer.
      if (productType === "other") {
        expect(stack.framework).toBe("custom");
        expect(stack.describe).toBeUndefined();
      } else if (stack.framework === "custom") {
        expect(stack.describe).toBeTruthy();
      } else {
        expect(stack.describe).toBeUndefined();
      }
    }
  });
});

/* ── Showing rather than describing (spec 159) ─────────────────────────────── */

describe("the founder can show what they mean", () => {
  const references = question("uiReferenceLinks");

  it("asks for references on their own screen, after the founder has written what they want", () => {
    const order = interviewQuestions.map((q) => q.id);
    expect(references.type).toBe("references");
    expect(order.indexOf("uiReferenceLinks")).toBeGreaterThan(order.indexOf("uiDirection"));
  });

  it("caps the links, and the field the founder types them into", () => {
    expect(references.maxChars).toBe(ANSWER_MAX_CHARS.uiReferenceLinks);
    expect(MAX_UI_REFERENCE_LINKS).toBeGreaterThan(0);
  });

  it("splits links the same way whatever the founder separated them with", () => {
    expect(splitReferenceLinks(" linear.app  stripe.com , vercel.com\n")).toEqual([
      "linear.app",
      "stripe.com",
      "vercel.com"
    ]);
    expect(splitReferenceLinks("   ")).toEqual([]);
  });

  it("asks how it should look exactly once, with the starting points inside that one question", () => {
    // Two questions became one: asking for a brief and then asking which of five was closest made
    // the founder answer the same thing twice, and left two answers that could disagree.
    const uiQuestions = interviewQuestions.filter((q) => q.id.startsWith("ui"));
    expect(uiQuestions.map((q) => q.id)).toEqual(["uiDirection", "uiReferenceLinks"]);

    const direction = question("uiDirection");
    expect(direction.type).toBe("guided_text");
    expect(direction.options?.length).toBeGreaterThanOrEqual(6);
  });

  it("writes the picked direction into the field, and leaves it empty for the founder's own words", () => {
    const options = question("uiDirection").options ?? [];
    const ownWords = options.find((o) => o.value === "describe_myself");
    const presets = options.filter((o) => o.value !== "describe_myself");

    // The whole mechanic: a pick is a sentence in the field, editable from that moment.
    expect(presets.length).toBe(5);
    for (const preset of presets) {
      expect(preset.prefill, `${preset.value} has no prefill`).toBeTruthy();
      expect(preset.prefill!.length).toBeLessThanOrEqual(ANSWER_MAX_CHARS.uiDirection);
    }
    expect(ownWords?.prefill).toBeUndefined();
  });

  it("names no real product in the directions it offers", () => {
    // The boundary this spec drew: our own directions, described. A named product here would be an
    // instruction to reproduce someone else's trade dress.
    const text = JSON.stringify(question("uiDirection"));
    for (const brand of ["Linear", "Stripe", "Vercel", "Notion", "Figma"]) {
      expect(text).not.toContain(brand);
    }
  });
});

describe("a question the founder cannot answer has a way past it", () => {
  const escapeHatches = [
    { list: "productType", text: "productTypeOther" },
    { list: "tenancy", text: "tenancyOther" },
    { list: "capabilities", text: "capabilitiesOther" },
    { list: "database", text: "databaseOther" },
    { list: "hosting", text: "hostingOther" }
  ] as const;

  it.each(escapeHatches)("offers 'something else' on $list and asks $text for it", ({ list, text }) => {
    const values = question(list).options?.map((o) => o.value) ?? [];
    expect(values).toContain("other");

    const followUp = question(text);
    expect(followUp.type).toBe("text");
    expect(followUp.showIf).toEqual([{ questionId: list, in: ["other"] }]);
    expect(followUp.maxChars).toBe(ANSWER_MAX_CHARS[text]);
  });

  it("only asks the follow-up when the founder took the escape hatch", () => {
    expect(visibleQuestions({ productType: "saas" }).map((q) => q.id)).not.toContain("productTypeOther");
    expect(visibleQuestions({ productType: "other" }).map((q) => q.id)).toContain("productTypeOther");
  });
});

describe("required means required, and optional means optional", () => {
  // The bug: `firstUnanswered` gates the submit button and ignored `required`, so every question
  // marked optional was mandatory in the interface — `coreEntities` said "skip it" and could not be
  // skipped. `validateCompleteAnswers` had always disagreed with it.
  const complete: InterviewAnswers = {
    productType: "saas",
    problem: "Managers track applications across email and spreadsheets.",
    vision: "The default tool for independent managers.",
    mvpFocus: "Create a listing and receive applications.",
    tenancy: "organizations",
    authModel: ["email_password"],
    capabilities: ["search"],
    framework: "nextjs",
    database: "supabase",
    hosting: "vercel",
    repoProvider: "github"
  };

  it("lets the founder submit without answering the optional questions", () => {
    expect(firstUnanswered(complete)).toBeNull();
  });

  it("still stops on a required question, including one the escape hatch revealed", () => {
    expect(firstUnanswered({ ...complete, problem: undefined })?.id).toBe("problem");
    expect(firstUnanswered({ ...complete, productType: "other" })?.id).toBe("productTypeOther");
  });

  it("shows the optional questions all the same — skipping is the founder's choice, not ours", () => {
    const ids = visibleQuestions(complete).map((q) => q.id);
    expect(ids).toContain("coreEntities");
    expect(ids).toContain("uiDirection");
    expect(ids).toContain("uiReferenceLinks");
  });

  it("no longer asks what the product is not doing", () => {
    // Removed outright rather than made optional (spec 159): the field survives for answers already
    // saved and for what an import analysis derives, but nobody is asked to invent non-goals.
    expect(interviewQuestions.map((q) => q.id)).not.toContain("nonGoals");
    expect(ANSWER_MAX_CHARS.nonGoals).toBeGreaterThan(0);
  });
});
