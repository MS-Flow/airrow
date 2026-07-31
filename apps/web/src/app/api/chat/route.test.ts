// The one endpoint an anonymous visitor can reach (spec 141).
//
// Its job is small and its failure modes are the point: it must never spend an answer it has not
// claimed, never charge a visitor for one they did not receive, and never return a shape the panel
// has no words for.
import { describe, it, expect, vi, beforeEach } from "vitest";

const answerQuestion = vi.hoisted(() => vi.fn());
const chatConfigured = vi.hoisted(() => vi.fn());
vi.mock("@/features/chat/provider", () => ({ answerQuestion, chatConfigured }));

const claimChatAnswer = vi.hoisted(() => vi.fn());
const releaseChatAnswer = vi.hoisted(() => vi.fn());
const visitorKey = vi.hoisted(() => vi.fn());
vi.mock("@/lib/data/chat-limits", () => ({ claimChatAnswer, releaseChatAnswer, visitorKey }));

import { POST } from "./route";

function post(body: unknown, headers: Record<string, string> = { "x-forwarded-for": "203.0.113.7" }) {
  return POST(
    new Request("https://airrow.test/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body)
    })
  );
}

const oneQuestion = { thread: [{ role: "visitor", text: "What does it cost?" }] };

describe("POST /api/chat", () => {
  beforeEach(() => {
    answerQuestion.mockReset();
    chatConfigured.mockReset().mockReturnValue(true);
    claimChatAnswer.mockReset().mockResolvedValue({ allowed: true });
    releaseChatAnswer.mockReset().mockResolvedValue(undefined);
    visitorKey.mockReset().mockReturnValue("hashed-visitor");
  });

  it("answers a well-formed question", async () => {
    answerQuestion.mockResolvedValue({ status: "answered", text: "Free for one foundation." });

    const response = await post(oneQuestion);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "answered",
      text: "Free for one foundation."
    });
  });

  it("says nothing to the model until an answer has been claimed", async () => {
    claimChatAnswer.mockResolvedValue({ allowed: false, reason: "visitor" });

    const response = await post(oneQuestion);

    await expect(response.json()).resolves.toEqual({ status: "limited", scope: "visitor" });
    expect(answerQuestion).not.toHaveBeenCalled();
  });

  it("tells the visitor which ceiling they met", async () => {
    claimChatAnswer.mockResolvedValue({ allowed: false, reason: "global" });

    // Their own allowance and the day's are different sentences in the panel: one is "come back
    // tomorrow", the other is "we are full today, and it is not about you".
    await expect((await post(oneQuestion)).json()).resolves.toEqual({
      status: "limited",
      scope: "global"
    });
  });

  it("gives the answer back when the model produced nothing", async () => {
    answerQuestion.mockResolvedValue({ status: "unavailable" });

    const response = await post(oneQuestion);

    await expect(response.json()).resolves.toEqual({ status: "unavailable" });
    // Otherwise five network blips would spend a visitor's whole day having told them nothing.
    expect(releaseChatAnswer).toHaveBeenCalledWith("hashed-visitor");
  });

  it("keeps the claim when the bot answered, even to decline", async () => {
    answerQuestion.mockResolvedValue({ status: "off_topic" });

    await expect((await post(oneQuestion)).json()).resolves.toEqual({ status: "off_topic" });
    expect(releaseChatAnswer).not.toHaveBeenCalled();
  });

  it("spends nothing at all on an unconfigured deployment", async () => {
    chatConfigured.mockReturnValue(false);

    await expect((await post(oneQuestion)).json()).resolves.toEqual({ status: "unavailable" });
    expect(claimChatAnswer).not.toHaveBeenCalled();
    expect(answerQuestion).not.toHaveBeenCalled();
  });

  it("refuses a body that is not a thread ending in a question", async () => {
    for (const body of [
      "not json",
      {},
      { thread: [] },
      { thread: [{ role: "assistant", text: "hello" }] },
      { thread: [{ role: "visitor", text: "" }] },
      { thread: [{ role: "visitor", text: "x".repeat(501) }] }
    ]) {
      const response = await post(body);
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ status: "invalid" });
    }
    expect(claimChatAnswer).not.toHaveBeenCalled();
  });

  it("closes a thread that has run out of turns instead of calling it invalid", async () => {
    const thread = Array.from({ length: 21 }, (_, i) => ({
      role: i % 2 === 0 ? "visitor" : "assistant",
      text: "q"
    }));

    const response = await post({ thread });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "thread_full" });
    expect(claimChatAnswer).not.toHaveBeenCalled();
  });

  it("counts a visitor by the address the platform reports, not one they can set", async () => {
    answerQuestion.mockResolvedValue({ status: "answered", text: "Yes." });

    await post(oneQuestion, { "x-forwarded-for": "198.51.100.4, 10.0.0.1" });
    expect(visitorKey).toHaveBeenCalledWith("198.51.100.4");

    await post(oneQuestion, { "x-real-ip": "198.51.100.9" });
    expect(visitorKey).toHaveBeenCalledWith("198.51.100.9");
  });

  it("cannot be answered by a request with no address at all", async () => {
    // `visitorKey` returns null, `claimChatAnswer` refuses it, and the panel falls back — an
    // unidentifiable caller is never served an unlimited chat.
    visitorKey.mockReturnValue(null);
    claimChatAnswer.mockResolvedValue({ allowed: false, reason: "unavailable" });

    await expect((await post(oneQuestion, {})).json()).resolves.toEqual({ status: "unavailable" });
    expect(answerQuestion).not.toHaveBeenCalled();
  });
});
