// The numbers the landing chat is bounded by (spec 141).
//
// A module with no imports, for the same reason `generation/limits.ts` is one: the route enforces
// these server-side and the panel states them to the visitor, and a fact lives in exactly one file
// (§IV). Splitting them out is what lets both read the same source without dragging Supabase or the
// Anthropic SDK into a client bundle.

/**
 * Answers the chat will produce in one day, across every visitor.
 *
 * This is the cost ceiling, and it is the number that matters: 250 answers on Haiku 4.5 is roughly a
 * dollar. The workspace's own spend limit sits behind it as the tak that survives a bug in this one.
 */
export const GLOBAL_DAILY_ANSWER_LIMIT = 250;

/**
 * Answers one visitor gets in a day.
 *
 * Not a fairness rule — it is what stops a single abuser eating the global ceiling before an actual
 * founder arrives. Deliberately low: a visitor who needs a sixth answer is better served by starting
 * a project than by a longer conversation with a chat panel.
 */
export const VISITOR_DAILY_ANSWER_LIMIT = 5;

/** Longest question accepted. Rejected by the schema, before anything is spent. */
export const MAX_MESSAGE_CHARS = 500;

/**
 * Turns one thread may hold before it is closed.
 *
 * Every turn is resent by the client and re-read by the model, so an unbounded thread is an
 * unbounded per-answer cost even inside the answer limits above.
 */
export const MAX_THREAD_TURNS = 10;
