// The wire between the chat panel and its route (spec 141).
//
// In its own file because both sides need it and neither may import the other: the panel is a client
// component and `provider.ts` carries the Anthropic SDK, the system prompt and the knowledge base —
// none of which may reach a browser bundle (§I).
import { z } from "zod";
import { MAX_MESSAGE_CHARS, MAX_THREAD_TURNS } from "./limits";

/** One exchange, as the client keeps it in `sessionStorage` and resends on every question. */
export const chatTurnSchema = z.object({
  role: z.enum(["visitor", "assistant"]),
  text: z.string().min(1).max(MAX_MESSAGE_CHARS)
});

/**
 * One turn, derived from the schema rather than declared beside it (§I).
 *
 * It lives here rather than in `provider.ts` so the panel can name the type it stores without
 * importing the module that carries the Anthropic SDK and the system prompt.
 */
export type ChatTurn = z.infer<typeof chatTurnSchema>;

/**
 * The request.
 *
 * The whole thread arrives from the client every time, because nothing about a visitor is stored
 * server-side. That makes it untrusted input twice over — for its content, which the prompt treats as
 * data, and for its shape, which is what this schema is for. The turn ceiling is enforced on the
 * count of *visitor* turns, so a client that fabricates assistant turns cannot buy itself a longer
 * thread.
 */
export const chatRequestSchema = z
  .object({ thread: z.array(chatTurnSchema).min(1).max(MAX_THREAD_TURNS * 2) })
  .refine((body) => body.thread[body.thread.length - 1]?.role === "visitor", {
    message: "the thread must end with the visitor's question"
  })
  .refine((body) => body.thread.filter((turn) => turn.role === "visitor").length <= MAX_THREAD_TURNS, {
    message: "too many questions in one thread"
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * The reply, as a discriminated union rather than an HTTP status.
 *
 * Only `invalid` is a real error; every other arm is a state the panel has words for, so they all
 * come back as 200. A visitor who has used their five answers has not made a bad request, and a
 * panel that had to read both a status code and a body to tell those apart would get it wrong.
 */
export type ChatReply =
  /**
   * `support` asks the panel to show its own hand-off row (spec 158). A flag and not a URL: the link
   * is written into the panel, so nothing the model produces can decide where a visitor is sent.
   */
  | { status: "answered"; text: string; support: boolean }
  | { status: "off_topic" }
  | { status: "thread_full" }
  /** Which ceiling was hit. The panel says different things about the visitor's and the day's. */
  | { status: "limited"; scope: "visitor" | "global" }
  | { status: "unavailable" }
  | { status: "invalid" };
