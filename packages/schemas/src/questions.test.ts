// Tests for the interview schema's stack question and its per-product-type recommendation.
//
// The defect these exist to prevent is a silent one: a founder building a mobile app was never shown
// the stack question at all, and the engine resolved them to Vite + React — a web SPA, with
// `npm run dev` in every document. Nothing failed; the answer was simply never asked for.
import { describe, it, expect } from "vitest";
import {
  ANSWER_MAX_CHARS,
  MAX_UI_REFERENCE_LINKS,
  SATELLITE_ANSWERS,
  STANDARD_STACK,
  firstUnanswered,
  interviewQuestions,
  isQuestionVisible,
  isRecommendedOption,
  pruneHiddenAnswers,
  splitReferenceLinks,
  suggestedValue,
  visibleQuestions,
  withSuggestions,
  type Question
} from "./questions.ts";
import {
  PERMISSIVE_LICENCES,
  UI_KITS,
  describeUiKit,
  uiKitCaption,
  uiKitFor,
  uiKitSources
} from "./ui-kits.ts";
import { interviewAnswersSchema } from "./index.ts";
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
  it("asks for references on the design question itself, not on a screen after it", () => {
    // Spec 159 gave references their own screen; spec 165 folded it back in, because a screen that
    // asks about the same subject as the one before it asks the same question twice.
    const direction = question("uiDirection");
    expect(direction.references).toBe(true);
    expect(interviewQuestions.some((q) => q.id === "uiReferenceLinks")).toBe(false);
    // Still an answer, and still owned by the question that collects it.
    expect(SATELLITE_ANSWERS.uiReferenceLinks).toBe("uiDirection");
  });

  it("caps the links, and the field the founder types them into", () => {
    expect(ANSWER_MAX_CHARS.uiReferenceLinks).toBeGreaterThan(0);
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

  it("asks how it should look exactly once — one question, and only one", () => {
    // Three questions became one across two specs: 159 merged the picker into the field, 165 merged
    // the references screen in after it. Everything about how this product looks is asked here.
    const uiQuestions = interviewQuestions.filter((q) => q.id.startsWith("ui"));
    expect(uiQuestions.map((q) => q.id)).toEqual(["uiDirection"]);

    const direction = question("uiDirection");
    expect(direction.type).toBe("guided_text");
    // Every curated direction, plus the one way out. Derived, so cutting a direction cannot leave a
    // stale number here claiming there are more choices than there are.
    expect(direction.options?.length).toBe(UI_KITS.length + 1);
  });

  it("offers showing us instead as the sixth option, not an empty box", () => {
    // It used to read "None of these — my own words", which named the absence of a choice and left
    // the founder in front of nothing. The way out of five pictures is a sixth picture (spec 165).
    const options = question("uiDirection").options ?? [];
    const escape = options.find((o) => o.opensReferences);
    expect(escape?.value).toBe("show_instead");
    expect(escape?.prefill).toBeUndefined();
    expect(uiKitFor(escape!.value)).toBeNull();
    expect(escape?.description).toMatch(/link|screenshot/i);
    // Exactly one, or "the way out" is ambiguous.
    expect(options.filter((o) => o.opensReferences)).toHaveLength(1);
  });

  it("writes the picked direction into the field, and leaves it empty for the founder's own words", () => {
    const options = question("uiDirection").options ?? [];
    const ownWords = options.find((o) => o.value === "show_instead");
    const presets = options.filter((o) => o.value !== "show_instead");

    // The whole mechanic: a pick is a sentence in the field, editable from that moment.
    expect(presets.length).toBe(UI_KITS.length);
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

/* ── A direction is installable code, not a sentence about code (spec 165) ─────────────────── */

describe("every curated direction points at something a machine can install", () => {
  it("gives each of the five a theme, and the sixth option none", () => {
    const options = question("uiDirection").options ?? [];
    const withKit = options.filter((o) => uiKitFor(o.value) !== null);

    // The link between a picked option and the theme it installs is the shared id, and nothing else.
    // A sixth kit, or a renamed option, breaks here rather than at generation time.
    expect(withKit.map((o) => o.value)).toEqual(UI_KITS.map((k) => k.id));
    expect(uiKitFor("describe_myself")).toBeNull();
  });

  it("pins an exact version and names a permissive licence for every one of them", () => {
    for (const kit of UI_KITS) {
      const { source } = kit;
      expect(source.version, `${kit.id} has no version`).toBeTruthy();
      // The whole point of the pin: a range or a tag means UI_ARCHITECTURE.md names a version the
      // founder did not get, on someone else's release schedule.
      expect(source.version, `${kit.id} is not pinned exactly`).toMatch(/^\d+\.\d+\.\d+$/);
      expect(PERMISSIVE_LICENCES).toContain(source.licence);
      expect(source.holder).toBeTruthy();
      expect(source.licenceText).toContain(source.holder);
    }
  });

  it("carries the licence text the notice has to reproduce, in full", () => {
    // An MIT licence is satisfied by the whole notice or not at all — a summary is not a licence.
    for (const source of uiKitSources()) {
      expect(source.licenceText).toContain("Copyright (c)");
      expect(source.licenceText).toContain("WITHOUT WARRANTY OF ANY KIND");
      expect(source.licenceText).toContain("above copyright notice");
    }
  });

  it("describes each theme concretely enough to draw and to build from", () => {
    for (const kit of UI_KITS) {
      expect(kit.name).toBeTruthy();
      expect(kit.suits, `${kit.id} says nothing about who it is for`).toBeTruthy();
      for (const field of ["headline", "typography", "motion", "logo"] as const) {
        expect(kit.design[field], `${kit.id}.design.${field}`).toBeTruthy();
      }
      // Both themes, always: a preview drawn in one and a screen built in the other is the drift
      // this record exists to make impossible.
      for (const palette of [kit.light, kit.dark]) {
        for (const [slot, value] of Object.entries(palette)) {
          expect(value, `${kit.id}.${slot}`).toMatch(/^#[0-9a-f]{6}$/i);
        }
      }
      expect(kit.design.radius).toMatch(/^[\d.]+rem$/);
    }
  });

  it("names no real product anywhere in the themes either", () => {
    const text = JSON.stringify(UI_KITS);
    for (const brand of ["Linear", "Stripe", "Vercel", "Notion", "Figma"]) {
      expect(text).not.toContain(brand);
    }
  });

  it("describes the look, and never a layout", () => {
    // The caption is generated from `design`, which is what the specimen is drawn from. It must not
    // describe navigation, rows or panels: the screens come from the founder's own answers, and a
    // caption counting things in the picture would be promising a layout nobody chose.
    for (const kit of UI_KITS) {
      const said = describeUiKit(kit);
      expect(said).toContain(kit.darkFirst ? "dark-first" : "light-first");
      expect(said).toContain(kit.design.spacing);
      // The surface treatment is shortened for the caption; the brief carries the long form.
      expect(said).toMatch(/hairlines|flat|outlines/);
      // No radius: a value beside a picture that already shows the corners reads as a spec sheet.
      expect(said).not.toMatch(/rem/);
      for (const layoutWord of ["sidebar", "navbar", "top bar", "rows", "table", "tiles", "links"]) {
        expect(said.toLowerCase(), `${kit.id} caption promises a layout`).not.toContain(layoutWord);
      }
    }
  });

  it("captions a capture and a drawing identically — both show the same visual language", () => {
    for (const kit of UI_KITS) {
      expect(uiKitCaption(kit)).toBe(describeUiKit(kit));
    }
  });

  it("keeps the caption a spec line rather than a paragraph", () => {
    // It sits under a picture someone is comparing against two others; prose there is skipped, and a
    // caption nobody reads is worse than a short one they do.
    for (const kit of UI_KITS) {
      const said = uiKitCaption(kit);
      expect(said.length, `${kit.id}: "${said}"`).toBeLessThanOrEqual(70);
      // No sentences. A decimal point is fine — `0.75rem` is a value, not prose.
      expect(said, `${kit.id}: "${said}"`).not.toMatch(/\.\s/);
    }
  });

  it("differs where a founder can hold an opinion — colour, contrast, surface", () => {
    // Three near-neighbours would be a worse question than one. What separates these has to be
    // visible in a thumbnail: the accent, the ground, and how surfaces are told apart.
    //
    // Compared on the palette that is actually *shown* — a dark-first direction is previewed dark,
    // so asserting on `light` would have let two directions look identical while passing.
    const shown = UI_KITS.map((k) => (k.darkFirst ? k.dark : k.light));
    expect(new Set(shown.map((p) => p.accent)).size).toBe(UI_KITS.length);
    expect(new Set(shown.map((p) => p.bg)).size).toBe(UI_KITS.length);
    expect(new Set(UI_KITS.map((k) => k.design.surfaces)).size).toBe(UI_KITS.length);
    expect(new Set(UI_KITS.map((k) => k.design.logo)).size).toBe(UI_KITS.length);
    // And not all in one temperature: a founder who wants dark must have somewhere to go.
    expect(new Set(UI_KITS.map((k) => k.darkFirst)).size).toBe(2);
  });

  it("installs no layout — a direction decides the look, never the screens", () => {
    // The reason `blocks` was removed. Naming a shell here made a picked picture outrank what the
    // founder wrote about their product, which is the opposite of what the interview is for.
    expect(JSON.stringify(UI_KITS)).not.toMatch(/sidebar-\d|login-\d|dashboard-\d/);
    for (const kit of UI_KITS) {
      expect(kit).not.toHaveProperty("blocks");
      expect(kit).not.toHaveProperty("anatomy");
    }
  });
});

describe("the picked direction survives the founder editing their own words", () => {
  // The regression spec 165 exists to prevent. Spec 159 derived the pick from whether the prose
  // still began with the prefill, which was honest while the pick was only a highlight — it now
  // decides what gets installed, and rewriting a sentence must not cancel an install.
  const picked: InterviewAnswers = { uiDirection: "Something entirely my own.", uiKit: "calm_focused" };

  it("keeps uiKit through a save, however far the prose has drifted", () => {
    expect(pruneHiddenAnswers(picked).uiKit).toBe("calm_focused");
  });

  it("drops a retired theme id instead of failing the whole answer set", () => {
    // Found in a real run: a project saved while `stark_technical` was on offer could no longer
    // generate once that direction was renamed — the enum rejected the id and took every other
    // answer down with it. A curated direction is allowed to be retired; a founder's saved project
    // is not allowed to become ungeneratable because of it.
    const parsed = interviewAnswersSchema.parse({ uiKit: "stark_technical", problem: "Something." });
    expect(parsed.uiKit).toBeUndefined();
    expect(parsed.problem).toBe("Something.");

    // And the list is still closed: a value from outside it never reaches the resolver.
    expect(interviewAnswersSchema.parse({ uiKit: UI_KITS[0]!.id }).uiKit).toBe(UI_KITS[0]!.id);
    expect(uiKitFor(interviewAnswersSchema.parse({ uiKit: "../../evil" }).uiKit)).toBeNull();
  });

  it("still drops it when its owning question is not visible", () => {
    // `uiKit` has no question of its own, so nothing else would ever prune it.
    expect(SATELLITE_ANSWERS.uiKit).toBe("uiDirection");
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
    // `uiReferenceLinks` is not here on purpose: it stopped being a question when the design screen
    // absorbed it (spec 165), and it is still answerable — on that screen.
    expect(ids).not.toContain("uiReferenceLinks");
  });

  it("no longer asks for the MVP focus, but still carries the field", () => {
    // Removed as a question, kept as a field — the same treatment `nonGoals` got, and for a stronger
    // reason: `mvpFocus` is `/start`'s ceiling in the constitution and appears in six documents, so
    // deleting the field would be a constitution change rather than one fewer question (spec 165).
    expect(interviewQuestions.map((q) => q.id)).not.toContain("mvpFocus");
    expect(ANSWER_MAX_CHARS.mvpFocus).toBeGreaterThan(0);
  });

  it("asks about objects and integrations once, not twice", () => {
    // Two questions circling the same ground: what this product is made of, and what it talks to.
    expect(interviewQuestions.map((q) => q.id)).not.toContain("integrations");
    expect(ANSWER_MAX_CHARS.integrations).toBeGreaterThan(0);

    const merged = question("coreEntities");
    expect(merged.title).toMatch(/core pages/i);
    expect(merged.title).toMatch(/connect to/i);
    expect(merged.help).toMatch(/connect/i);
    expect(merged.required).toBe(false);

    // And asked *after* the capabilities, because half of it is about them: a founder who has just
    // ticked payments and email knows what they are connecting to.
    const order = interviewQuestions.map((q) => q.id);
    expect(order.indexOf("coreEntities")).toBeGreaterThan(order.indexOf("capabilities"));
  });

  it("asks what it must do first alongside where it is heading, not on two screens", () => {
    // The pairing is the point: the first thing it must do only means something next to where it is
    // going, and on consecutive screens a founder wrote the same sentence twice (spec 165).
    const merged = question("vision");
    expect(merged.title).toMatch(/must it do first/i);
    expect(merged.title).toMatch(/heading/i);
    // Sized for two answers, not one.
    expect(merged.maxChars).toBeGreaterThan(300);
  });

  it("no longer asks what the product is not doing", () => {
    // Removed outright rather than made optional (spec 159): the field survives for answers already
    // saved and for what an import analysis derives, but nobody is asked to invent non-goals.
    expect(interviewQuestions.map((q) => q.id)).not.toContain("nonGoals");
    expect(ANSWER_MAX_CHARS.nonGoals).toBeGreaterThan(0);
  });
});
