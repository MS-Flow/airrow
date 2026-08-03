// What the landing chat knows (spec 141).
//
// Handwritten, not retrieved. The knowledge surface is two pages of text, so a vector store would be
// a second copy of the truth to keep in sync rather than a way of finding it.
//
// Most of it is *derived from the landing page itself* — `landing/copy.ts` is already the one place
// that says what we promise, and it already reads the free tier's numbers from
// `generation/limits.ts` (spec 74). Building the prompt out of that file is what makes it impossible
// for the bot to contradict the page it sits on, or to name a limit the product does not enforce: a
// changed price is a changed answer in the same commit (§IV).
//
// Only what the page does not say is written here by hand, and every line of it is a fact a founder
// asks about rather than a sentence we would like to sell them.
import {
  DELIVERABLES,
  FOUNDATION_HIGHLIGHTS,
  HERO,
  INCLUDED,
  PRO_INCLUDED,
  SECTIONS,
  SPEC_LOOP,
  STEPS,
  WHY_SDD
} from "@/features/landing/copy";
import { ARCHER } from "./copy";

/**
 * The things the landing page does not put in words, and a visitor asks anyway.
 *
 * The first entry is the one that decides whether someone starts a project. It is deliberately the
 * bluntest sentence in this file: "does Airrow write my app" is the question we lose people on, and
 * an answer that hedges reads as a yes.
 */
const BEYOND_THE_PAGE = [
  // Support arrived after the chat did (spec 144, wired in by spec 158). The login step is part of
  // the fact, not a footnote to it: support lives inside the app, and the visitor has to hear that
  // *before* they follow the link rather than discover it on the sign-in screen.
  "Airrow has a support page where a real person answers. It lives inside the app, so reaching it means signing in first — say so when you point someone at it.",
  "Airrow's servers never write your application code. They write the foundation: architecture, specifications, standards, workflow, CI and the context files an AI agent reads. That boundary is deliberate and it does not have exceptions on our side.",
  "The one command that does write code runs on the founder's own machine, inside the repository they downloaded, and only when they run it. For a new project it is /start, which sets the project up until it runs and then builds the product's core action, once. For a project that already exists it is /cleanup, which reads the code that is there and rewrites the foundation's documents to match; it changes no code and deletes nothing. A foundation ships exactly one of the two, decided by where the project came from.",
  "The interview takes about five minutes. It only asks questions whose answers change the output.",
  "The repository is the founder's, in plain files with no lock-in, and it works with any AI coding assistant. Claude Code is the one it is tuned for.",
  "ZIP delivery always works on its own. Connecting GitHub is optional, and nothing is pushed anywhere without the founder approving it first.",
  "The founder previews the entire output, the file tree and the key files, before anything is written or delivered.",
  "Interview answers and generated documents belong to the founder, are reachable only by their own workspace, and are never used as training data.",
  "Importing an existing project is a Pro feature. The free tier is about starting something new.",
  "Airrow is built with Airrow: this product's own repository runs the same specs, the same constitution and the same loop it generates."
] as const;

/**
 * Who the visitor is talking to (spec 158).
 *
 * The name is imported from `copy.ts` rather than written again here, because the panel prints it on
 * the header two inches above the answer: a bot that introduces itself as something else than the
 * label on its own window is the one identity bug a visitor is guaranteed to notice.
 */
const IDENTITY = [
  `Your name is ${ARCHER}.`,
  "You are Airrow's assistant — software, not a person. If anyone asks who or what they are talking to, say that plainly. Never claim to be a member of the team, and never imply a human is reading."
] as const;

/** Turns a list of strings into the bullet block the prompt is assembled from. */
function bullets(lines: readonly string[]): string {
  return lines.map((line) => `- ${line}`).join("\n");
}

/**
 * Everything the bot may state as fact, assembled from the page plus the lines above.
 *
 * Built at call time rather than as a module constant so a test can prove the derivation is live —
 * a frozen string would pass the same test while having stopped tracking `copy.ts` months earlier.
 */
export function buildKnowledge(): string {
  return [
    `WHO YOU ARE\n${bullets(IDENTITY)}`,
    `WHAT AIRROW IS\n${HERO.leadBrand}${HERO.leadRest}`,
    `HOW IT WORKS\n${bullets(STEPS.map((s) => `${s.title}: ${s.body}`))}`,
    `WHAT A FOUNDATION CONTAINS\n${bullets(DELIVERABLES.map((d) => `${d.title}: ${d.body}`))}`,
    `FILES A FOUNDATION SHIPS\n${bullets(FOUNDATION_HIGHLIGHTS.map((f) => `${f.path}: ${f.reason}`))}`,
    `THE SPEC LOOP\n${SECTIONS.specDriven.loopNote} The commands are: ${SPEC_LOOP.join(", ")}.`,
    `WHY SPEC-DRIVEN\n${bullets(WHY_SDD)}`,
    // Archer still names no figure, and now for a sharper reason than before: since spec 179 the
    // pricing card fetches the amount from Stripe per render, and this prompt is built from static
    // copy. A number here could only ever be a second, staler source of truth for the one fact a
    // visitor would act on. It points at the two places that are always right instead.
    `PRICING\n${SECTIONS.pricing.body}\nFree (${SECTIONS.pricing.free.amount}): ${SECTIONS.pricing.free.note}\n${bullets(INCLUDED)}\nPro (${SECTIONS.pricing.pro.perMonth} or ${SECTIONS.pricing.pro.perYear}; the amount is on the pricing section of this page and at checkout): ${SECTIONS.pricing.pro.note}\n${bullets(PRO_INCLUDED)}`,
    `FACTS THE PAGE DOES NOT STATE\n${bullets(BEYOND_THE_PAGE)}`
  ].join("\n\n");
}

/*
 * The handwritten answers live in `faq.ts`, not here, and deliberately: the panel imports those and
 * the panel is a client component, so anything in the same module would be shipped to every
 * visitor's browser. This file is only ever imported by `provider.ts`, which runs on the server.
 */
