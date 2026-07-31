// The bot may not contradict the page it sits on (spec 141).
//
// These tests are about one property: the knowledge is *derived*, not retyped. A second copy of the
// pricing would pass a reading of the file and be wrong the first time someone edited `copy.ts` — so
// what is asserted here is that the exact strings the landing page renders come back out of
// `buildKnowledge()`, and that the free tier's numbers still trace to `generation/limits.ts`.
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { FREE_GENERATION_LIMIT, REPAIR_WINDOW_HOURS } from "@/features/generation/limits";
import { INCLUDED, SECTIONS, STEPS } from "@/features/landing/copy";
import { FAQ, SUGGESTED_QUESTIONS } from "./faq";
import { buildKnowledge } from "./knowledge";

describe("what the landing chat knows", () => {
  it("states the free tier in the landing page's own words", () => {
    const knowledge = buildKnowledge();

    expect(knowledge).toContain(SECTIONS.pricing.free.note);
    expect(knowledge).toContain(SECTIONS.pricing.body);
  });

  it("carries the free tier's numbers through from limits.ts, not a second copy", () => {
    const knowledge = buildKnowledge();

    // `INCLUDED[0]` is assembled in copy.ts from FREE_GENERATION_LIMIT and FREE_REPAIR_LIMIT. Its
    // presence here is the whole chain: limits.ts → copy.ts → the prompt.
    expect(knowledge).toContain(INCLUDED[0]);
    expect(knowledge).toContain(String(REPAIR_WINDOW_HOURS));
    // And the shipped ceiling really is the one the copy spells out, so the assertion above cannot
    // pass on a stale string.
    expect(INCLUDED[0]).toContain(FREE_GENERATION_LIMIT === 1 ? "One" : String(FREE_GENERATION_LIMIT));
  });

  it("describes how it works in the same three steps the page does", () => {
    const knowledge = buildKnowledge();

    for (const step of STEPS) expect(knowledge).toContain(step.body);
  });

  it("names the boundary that decides whether a visitor starts a project", () => {
    const knowledge = buildKnowledge();

    // "Do you write my app?" is the question people leave over. The answer has to be in the prompt
    // in as many words, because a model asked to infer it will hedge.
    expect(knowledge).toContain("never write your application code");
    expect(knowledge).toMatch(/\/start/);
    expect(knowledge).toMatch(/\/cleanup/);
  });

  it("never promises a Pro price, which lives in Stripe", () => {
    // The landing page deliberately carries no figure for Pro (spec 99) — the amount lives in Stripe
    // so it can change without a deploy, and a bot that invented one would be making a promise
    // nobody can honour at checkout. Free's own "$0" is the one figure allowed to be here.
    expect(buildKnowledge()).not.toMatch(/\$[1-9]/);
    expect(SECTIONS.pricing.pro.amount).not.toMatch(/\d/);
  });

  it("offers exactly the questions it can answer without a model", () => {
    // The suggestions and the fallback are the same four answers; that is what makes the offline
    // panel free to maintain rather than a second body of copy.
    expect(SUGGESTED_QUESTIONS).toEqual(FAQ.map((entry) => entry.question));
    for (const entry of FAQ) expect(entry.answer.length).toBeGreaterThan(0);
  });

  it("answers the cost question from the same source the prompt uses", () => {
    const cost = FAQ.find((entry) => entry.question.includes("cost"));

    expect(cost?.answer).toContain(SECTIONS.pricing.free.note);
  });

  it("stays out of the browser bundle", () => {
    // The panel is a client component, so whatever it imports is shipped to every visitor. It may
    // have the four answers it renders and must not have the document written for the model — this
    // is the import that would quietly put it there, and tree-shaking is not a guarantee to rely on.
    const widget = readFileSync(new URL("./ChatWidget.tsx", import.meta.url), "utf8");

    expect(widget).toContain('from "./faq"');
    expect(widget).not.toMatch(/from "\.\/knowledge"/);
    expect(widget).not.toMatch(/from "\.\/provider"/);
  });
});
