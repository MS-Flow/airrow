// What the mailer promises the two things that call it (spec 144): it answers, and it never throws.
//
// Everything above this module has already written the row that matters before it gets here, so the
// only wrong behaviour available to it is raising — a support ticket that was saved must not come
// back as a 500 because Resend was unreachable.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sendMail, supportInbox } from "./email";

const originalEnv = { ...process.env };

beforeEach(() => {
  process.env.RESEND_API_KEY = "re_test";
  delete process.env.SUPPORT_INBOX;
  delete process.env.MAIL_FROM;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

/** The last request `sendMail` made, decoded. */
function captureFetch(response: Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response);
  vi.stubGlobal("fetch", fetchMock);
  return {
    body: (): Record<string, unknown> =>
      JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<string, unknown>,
    calls: () => fetchMock.mock.calls.length
  };
}

const ok = (payload: unknown = { id: "msg_1" }) =>
  new Response(JSON.stringify(payload), { status: 200 });

describe("sendMail", () => {
  it("skips without an API key, and does not reach the network", async () => {
    delete process.env.RESEND_API_KEY;
    const sent = captureFetch(ok());

    expect(await sendMail({ subject: "Hi", text: "body" })).toEqual({ status: "skipped" });
    expect(sent.calls()).toBe(0);
  });

  it("reports failure on a non-2xx instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 422 })));

    await expect(sendMail({ subject: "Hi", text: "body" })).resolves.toEqual({
      status: "failed",
      reason: "resend 422"
    });
  });

  it("reports failure when the network is gone instead of throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("getaddrinfo ENOTFOUND api.resend.com");
      })
    );

    const result = await sendMail({ subject: "Hi", text: "body" });

    expect(result.status).toBe("failed");
    expect(result).toMatchObject({ reason: expect.stringContaining("ENOTFOUND") });
  });

  it("returns the message id on success", async () => {
    captureFetch(ok({ id: "msg_42" }));

    expect(await sendMail({ subject: "Hi", text: "body" })).toEqual({
      status: "sent",
      id: "msg_42"
    });
  });

  it("survives a success body that is not the shape we expect", async () => {
    captureFetch(ok({ unexpected: true }));

    expect(await sendMail({ subject: "Hi", text: "body" })).toEqual({ status: "sent", id: "" });
  });

  it("strips newlines out of the subject and reply-to, so neither can inject a header", async () => {
    const sent = captureFetch(ok());

    await sendMail({
      subject: "Broken\r\nBcc: someone@example.com",
      text: "body\nwith a newline, which is fine",
      replyTo: "founder@example.com\r\nBcc: else@example.com"
    });

    const body = sent.body();
    expect(body.subject).toBe("Broken Bcc: someone@example.com");
    expect(body.reply_to).toBe("founder@example.com Bcc: else@example.com");
    // The message body is not a header, and folding it would mangle what the founder wrote.
    expect(body.text).toContain("\n");
  });

  it("sends to the support inbox, which a deployment can point elsewhere", async () => {
    const sent = captureFetch(ok());
    process.env.SUPPORT_INBOX = "staging@airrow.test";

    await sendMail({ subject: "Hi", text: "body" });

    expect(supportInbox()).toBe("staging@airrow.test");
    expect(sent.body().to).toEqual(["staging@airrow.test"]);
  });

  it("defaults to the real inbox and Airrow's sending identity", async () => {
    const sent = captureFetch(ok());

    await sendMail({ subject: "Hi", text: "body" });

    expect(sent.body().to).toEqual(["support@airrow.app"]);
    expect(sent.body().from).toBe("Airrow <noreply@airrow.app>");
  });
});
