// Interview answers, as a person reads them (spec 150).
//
// The console shows a founder's interview so support can see what a generation was actually given.
// Raw jsonb — `{"mvpFocus":"…","framework":"nextjs"}` — answers the question technically and not at
// all in practice: the ids are ours, the option values are ours, and neither is what the founder saw.
//
// Pure, and deliberately outside `lib/data/admin.ts`: that module reads, this one formats, and keeping
// the formatter out of the data layer is what lets it be tested without a database.
import { interviewQuestions } from "@airrow/schemas";

export interface ReadableAnswer {
  id: string;
  question: string;
  answer: string;
}

/** The label a founder was shown for an option value, falling back to the raw value. */
function optionLabel(questionId: string, value: string): string {
  const question = interviewQuestions.find((q) => q.id === questionId);
  return question?.options?.find((o) => o.value === value)?.label ?? value;
}

function formatValue(questionId: string, value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((v) => optionLabel(questionId, String(v))).join(", ");
  }
  if (typeof value === "string") return optionLabel(questionId, value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

/**
 * The interview in the order it was asked, with the questions the founder actually answered.
 *
 * Driven by `interviewQuestions` rather than by the keys of the stored object, for the same reason
 * `toJob` re-checks `rejected_answers` on the way out of the store: an answer to a question that has
 * since been removed from the interview is stale data, and showing it under a question id nobody can
 * look up would be worse than not showing it. Anything stored under an unknown id is dropped.
 *
 * Empty answers are dropped too — an unanswered optional question is noise on a screen whose job is to
 * show what the generation had to work with.
 */
export function readableAnswers(stored: unknown): ReadableAnswer[] {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return [];
  // `as` justified: narrowed to a non-array object above; the values stay `unknown` and are formatted
  // defensively, because this is a jsonb column and nothing guarantees its shape.
  const answers = stored as Record<string, unknown>;

  return interviewQuestions.flatMap((question) => {
    const value = answers[question.id];
    if (value === undefined || value === null) return [];
    const answer = formatValue(question.id, value);
    if (!answer.trim()) return [];
    return [{ id: question.id, question: question.title, answer }];
  });
}
