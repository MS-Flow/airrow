// The landing chat's endpoint (spec 141).
//
// Public by construction rather than by exception: the middleware matcher covers `/app` and
// `/api/projects` only, so nothing had to be opened up for this route to be reachable by an
// anonymous visitor.
//
// Thin, like every route (§I): it validates the request, decides whether an answer may be spent, and
// hands the thread to the one place that talks to Claude. Nothing about the conversation is stored,
// and nothing about it is logged — not the question, not the answer (§II).
import { NextResponse } from "next/server";
import { chatRequestSchema, type ChatReply } from "@/features/chat/contract";
import { MAX_THREAD_TURNS } from "@/features/chat/limits";
import { answerQuestion, chatConfigured } from "@/features/chat/provider";
import { claimChatAnswer, releaseChatAnswer, visitorKey } from "@/lib/data/chat-limits";

/** `visitorKey` hashes with `node:crypto`, which the edge runtime does not carry. */
export const runtime = "nodejs";

/**
 * The address the request came from, as the platform reports it.
 *
 * `x-forwarded-for` is a list when there are proxies in front; the first entry is the client. Both
 * headers are set by the platform on the way in — a header a *visitor* sets is overwritten, which is
 * what makes this usable as a rate-limit key at all.
 */
function callerAddress(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return req.headers.get("x-real-ip");
}

function reply(body: ChatReply, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  // Asked before anything is parsed or claimed: an unconfigured deployment should cost a visitor
  // nothing and tell the panel to show its handwritten answers.
  if (!chatConfigured()) return reply({ status: "unavailable" });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return reply({ status: "invalid" }, 400);
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    // A thread at the ceiling is the one invalid request with a story worth telling: the panel closes
    // the thread rather than showing a validation failure for a question the visitor typed in good
    // faith.
    const turns = Array.isArray((body as { thread?: unknown[] })?.thread)
      ? (body as { thread: unknown[] }).thread.length
      : 0;
    if (turns > MAX_THREAD_TURNS) return reply({ status: "thread_full" });
    return reply({ status: "invalid" }, 400);
  }

  const key = visitorKey(callerAddress(req));
  const claim = await claimChatAnswer(key);
  if (!claim.allowed) {
    if (claim.reason === "unavailable") return reply({ status: "unavailable" });
    return reply({ status: "limited", scope: claim.reason });
  }

  const outcome = await answerQuestion(parsed.data.thread);

  // The claim was made before the call, because making the call is what costs money. When it produced
  // nothing, the visitor gets their allowance back — five network blips must not lock someone out for
  // the day having been told nothing.
  if (outcome.status === "unavailable") {
    await releaseChatAnswer(key);
    return reply({ status: "unavailable" });
  }

  if (outcome.status === "off_topic") return reply({ status: "off_topic" });
  return reply({ status: "answered", text: outcome.text });
}
