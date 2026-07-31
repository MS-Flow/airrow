// The handwritten answers (spec 141).
//
// Split out from `knowledge.ts` for one reason, and it is a hard one: **the panel is a client
// component and imports this file**. Anything living beside these four answers would be shipped to
// every visitor's browser, so the knowledge base the model is given — which is a longer document,
// written for a reader who is not the visitor — stays in `knowledge.ts` and is never imported here or
// by anything that renders.
//
// These four are the opposite: they exist to be shown. They are the suggested questions in the panel
// *and* the entire chat when the model is unreachable, the key is missing or the day's answers are
// spent, which is what makes the fallback free to maintain rather than a second body of copy.
import { SECTIONS } from "@/features/landing/copy";

/** A question, and the answer we stand behind without asking a model for one. */
export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ: readonly FaqEntry[] = [
  {
    question: "Does Airrow write my app?",
    answer:
      "No. Airrow writes the engineering foundation your app gets built on: architecture, specifications, standards, workflow, CI and the context files your AI agents read. The one command that writes code runs on your machine, in the repository you downloaded, and only when you run it."
  },
  {
    question: "What do I actually get?",
    answer:
      "A repository. Architecture and database design, one real spec per capability, coding and testing standards, a CI pipeline, a branching model, and the CLAUDE.md and context files that stop your agents guessing. Written for your product, from your interview answers, not filled in from a template."
  },
  {
    question: "What does it cost?",
    // The free tier's sentence is the landing page's own, so a changed limit changes this answer in
    // the same commit rather than leaving the chat promising last month's terms.
    answer: `${SECTIONS.pricing.free.note} No card. Pro lifts the limit and adds importing a project you have already started; the amount is shown at checkout.`
  },
  {
    question: "How long does it take?",
    answer:
      "About five minutes of questions, then the generation itself. You preview the whole repository, every file, before anything is delivered."
  }
] as const;

/** The questions offered as buttons, in the order they are asked in real life. */
export const SUGGESTED_QUESTIONS: readonly string[] = FAQ.map((entry) => entry.question);
