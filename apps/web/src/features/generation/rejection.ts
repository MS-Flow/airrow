// What the founder is told when their answers are refused (spec 128).
//
// The sibling of `allowanceMessage`, and for the same reason: a verdict travels as data, and the one
// place its wording lives is here — so the progress screen and the interview say the same thing.
//
// Every word is ours. The model names *which* answers led it to refuse; it never writes the sentence,
// so nothing it produced reaches the founder and there is no untrusted text on this path at all.
import { interviewQuestions, type AnswerId } from "@airrow/schemas";

/** The interview's own wording for an answer — what the founder saw when they typed it. */
function questionTitle(id: AnswerId): string | null {
  return interviewQuestions.find((q) => q.id === id)?.title ?? null;
}

/** `a`, `a and b`, `a, b and c` — the list reads as a sentence, not as output. */
function joinTitles(titles: readonly string[]): string {
  if (titles.length <= 1) return titles[0] ?? "";
  return `${titles.slice(0, -1).join(", ")} and ${titles.at(-1)}`;
}

/**
 * Why nothing was generated, in one line, for a reader who cannot see which answers are marked.
 *
 * The review screen has its own, shorter wording (`rejectionSummary`) because it marks the questions
 * themselves — naming seven of them in a sentence *and* beside every row says the same thing twice,
 * and the sentence is the copy that reads worst. This one is what lands in the job's `error`, where
 * the marks are not available: a founder who only ever sees this must still know what to rewrite.
 */
export function rejectionMessage(answers: readonly AnswerId[]): string {
  const titles = answers.map(questionTitle).filter((title): title is string => title !== null);
  const saved = "Everything you wrote is saved";
  if (titles.length === 0) {
    return (
      "Your answers don't describe a software product yet, so no foundation was generated. " +
      `${saved} — say what you're building in your own words and generate again.`
    );
  }
  return (
    `Your ${titles.length > 1 ? "answers" : "answer"} to ` +
    `${joinTitles(titles.map((title) => `“${title}”`))} ` +
    `${titles.length > 1 ? "don't" : "doesn't"} describe a software product yet, so no foundation ` +
    `was generated. ${saved} — rewrite ${titles.length > 1 ? "them" : "it"} and generate again.`
  );
}

/**
 * The same verdict for the review screen, which marks the questions itself.
 *
 * Short on purpose: the founder is looking at their answers with the ones to fix already flagged, so
 * the sentence's job is to say what happened and that nothing was lost — not to read a list back to
 * someone who can see it.
 */
export function rejectionSummary(answers: readonly AnswerId[]): string {
  const known = answers.filter((id) => questionTitle(id) !== null).length;
  const tail = "Everything you wrote is saved, and nothing was generated.";
  if (known === 0) {
    return `Your answers don't describe a software product yet. ${tail} Say what you're building in your own words and generate again.`;
  }
  return known === 1
    ? `One of your answers doesn't describe a software product yet. ${tail} Rewrite the marked answer and generate again.`
    : `${known} of your answers don't describe a software product yet. ${tail} Rewrite the marked answers and generate again.`;
}
