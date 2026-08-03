// The interview, made readable (spec 150).
//
// The console shows a founder's answers so support can see what a generation was given. Raw jsonb
// answers the question technically and not at all in practice, so these pin down the three things
// that make it useful: the question is the one the founder was asked, the answer is the label they
// chose rather than our stored value, and nothing stale or empty gets shown.
import { describe, it, expect } from "vitest";
import { interviewQuestions } from "@airrow/schemas";
import { readableAnswers } from "./answers";

/** A real question of each shape, so the test tracks the schema rather than restating it. */
const single = interviewQuestions.find((q) => q.type === "single" && q.options?.length);
const text = interviewQuestions.find((q) => q.type === "text");
const multi = interviewQuestions.find((q) => q.type === "multi" && q.options?.length);

describe("readableAnswers", () => {
  it("shows the question the founder was asked, not its id", () => {
    if (!text) throw new Error("the interview has no free-text question");
    const [answer] = readableAnswers({ [text.id]: "A thing I typed" });

    expect(answer?.question).toBe(text.title);
    expect(answer?.question).not.toBe(text.id);
    expect(answer?.answer).toBe("A thing I typed");
  });

  it("shows the label a founder chose, not the value we stored", () => {
    if (!single?.options?.[0]) throw new Error("the interview has no single-choice question");
    const option = single.options[0];
    const [answer] = readableAnswers({ [single.id]: option.value });

    // `nextjs` is our word for it; the founder picked something with a name.
    expect(answer?.answer).toBe(option.label);
  });

  it("joins a multi-select into one readable line", () => {
    if (!multi?.options?.length) throw new Error("the interview has no multi-select question");
    const picked = multi.options.slice(0, 2);
    const [answer] = readableAnswers({ [multi.id]: picked.map((o) => o.value) });

    expect(answer?.answer).toBe(picked.map((o) => o.label).join(", "));
  });

  it("keeps the interview's own order rather than the object's key order", () => {
    if (!single || !text) throw new Error("the interview is missing a question shape");
    // Written back-to-front on purpose: a screen that renders jsonb key order shows a different
    // interview to every founder.
    const rendered = readableAnswers({ [text.id]: "typed", [single.id]: single.options?.[0]?.value });
    const expected = interviewQuestions
      .filter((q) => q.id === text.id || q.id === single.id)
      .map((q) => q.title);

    expect(rendered.map((a) => a.question)).toEqual(expected);
  });

  it("drops an answer to a question the interview no longer asks", () => {
    // Stale rows outlive schema changes. Showing one under an id nobody can look up is worse than
    // not showing it — the same reasoning `toJob` applies to `rejected_answers`.
    expect(readableAnswers({ questionWeDeleted: "an old answer" })).toEqual([]);
  });

  it("drops empty and whitespace-only answers", () => {
    if (!text) throw new Error("the interview has no free-text question");
    expect(readableAnswers({ [text.id]: "" })).toEqual([]);
    expect(readableAnswers({ [text.id]: "   " })).toEqual([]);
  });

  it("survives anything that is not an answers object", () => {
    // jsonb guarantees nothing about shape, and this renders on the most sensitive screen we have.
    expect(readableAnswers(null)).toEqual([]);
    expect(readableAnswers(undefined)).toEqual([]);
    expect(readableAnswers("a string")).toEqual([]);
    expect(readableAnswers([1, 2, 3])).toEqual([]);
    expect(readableAnswers({})).toEqual([]);
  });

  it("does not choke on a value of an unexpected type", () => {
    if (!text) throw new Error("the interview has no free-text question");
    expect(readableAnswers({ [text.id]: { nested: "object" } })).toEqual([]);
    expect(readableAnswers({ [text.id]: 42 })).toEqual([
      { id: text.id, question: text.title, answer: "42" }
    ]);
  });
});
