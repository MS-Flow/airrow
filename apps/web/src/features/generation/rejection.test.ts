// What a founder reads when their answers are refused (spec 128). The point of these tests is that
// the sentence is ours end to end and names real questions — nothing here comes from a model.
import { describe, it, expect } from "vitest";
import { interviewQuestions } from "@airrow/schemas";
import { rejectionMessage, rejectionSummary } from "./rejection";

const titleOf = (id: string) => interviewQuestions.find((q) => q.id === id)?.title ?? "";

describe("rejectionMessage", () => {
  it("names the flagged answer in the interview's own words", async () => {
    const message = rejectionMessage(["problem"]);

    expect(message).toContain(titleOf("problem"));
    expect(message).toContain("no foundation was generated");
  });

  it("names every flagged answer, as a sentence rather than a list", () => {
    const message = rejectionMessage(["problem", "mvpFocus"]);

    expect(message).toContain(titleOf("problem"));
    expect(message).toContain(titleOf("mvpFocus"));
    expect(message).toContain(" and ");
  });

  it("stands on its own when the model named nothing", () => {
    // A rejection that named nothing usable is still a rejection — and an invented culprit would send
    // the founder to rewrite an answer that was fine.
    const message = rejectionMessage([]);

    expect(message).toContain("don't describe a software product yet");
    expect(message).not.toContain("“");
  });

  it("says the answers are safe, because the first fear is losing the work", () => {
    expect(rejectionMessage(["problem"])).toContain("saved");
  });
});

// The review screen marks the questions themselves, so its wording must not read the same list back.
// Seven titles in one sentence beside seven marked rows is what this replaces.
describe("rejectionSummary", () => {
  it("counts the answers instead of naming them", () => {
    const summary = rejectionSummary(["problem", "vision", "mvpFocus"]);

    expect(summary).toContain("3 of your answers");
    expect(summary).not.toContain(titleOf("problem"));
  });

  it("reads as one answer when there is one", () => {
    expect(rejectionSummary(["problem"])).toContain("One of your answers");
  });

  it("counts only answers the interview still recognises", () => {
    // The ids survive in the database; a question can be retired from under them.
    expect(rejectionSummary(["problem", "gone" as "problem"])).toContain("One of your answers");
  });

  it("still says what happened when nothing is marked", () => {
    const summary = rejectionSummary([]);

    expect(summary).toContain("don't describe a software product yet");
    expect(summary).toContain("saved");
  });
});
