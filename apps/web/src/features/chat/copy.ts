// Every visible string in the chat panel, in one place — the same discipline `landing/copy.ts`
// applies to the page around it (spec 23), for the same reason: the voice is reviewed as a whole
// instead of being hunted for across JSX.
//
// Separate from `knowledge.ts` on purpose. That file is what the bot *knows*; this one is what the
// panel *says* on its own behalf, in the states where no model was involved at all.
import { MAX_MESSAGE_CHARS, VISITOR_DAILY_ANSWER_LIMIT } from "./limits";

export const CHAT = {
  /** The closed state. Short enough to sit in a corner without competing with the hero. */
  launcher: "Ask about Airrow",
  title: "Ask about Airrow",
  subtitle: "Answers about what it builds, what you get and what it costs.",
  placeholder: "Ask a question",
  send: "Send",
  close: "Close",
  thinking: "Thinking",
  suggestionsLabel: "Common questions",
  /** Shown above the handwritten answers whenever the model is not in play. */
  faqIntro: "Here are the questions we get most often.",
  cta: "Create your project",
  /* One line, at the end of a thread rather than after every answer. A tool a founder is deciding
     about should not pitch them in every paragraph. */
  ctaNote: "Ready when you are.",
  /** The visitor's own daily allowance, spent. Not an error, and it says whose limit it was. */
  visitorLimit: `That is ${VISITOR_DAILY_ANSWER_LIMIT} answers for today. The questions below cover the rest, and the interview answers everything else.`,
  /** The global ceiling. A different sentence, because it is not the visitor's fault or their limit. */
  globalLimit:
    "The chat is at its limit for today, so this one is on the house of handwritten answers below.",
  /** No key, no network, nothing usable back. Never blamed on the visitor. */
  unavailable: "The chat is not answering right now. These are the questions it gets most often.",
  /** The model went somewhere it was told not to go, or the visitor did. */
  offTopic:
    "I only answer questions about Airrow. Ask me what it builds, what you get, or what it costs.",
  /** The thread has run out of turns. */
  threadFull:
    "That is as far as this thread goes. Start a project and the interview will ask better questions than I can.",
  tooLong: `Keep it under ${MAX_MESSAGE_CHARS} characters.`
} as const;
