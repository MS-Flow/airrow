// The one place the application sends an email (spec 144).
//
// Not the only mail Airrow sends: Supabase Auth sends the verification email over Resend's SMTP,
// configured by `scripts/sync-supabase-auth.mjs` (spec 113). That path is untouched. This one is the
// app's own, over Resend's HTTP API, and it exists for messages *to us* — a support ticket, a review.
//
// Built like the authoring provider: it **never throws**. Everything that calls it has already
// written the row that matters, so a missing key or a dead third party may cost a notification and
// must never cost the founder their confirmation. The result is a discriminated union rather than a
// boolean (§I) — "we are not configured to send" and "sending failed" are different facts, and only
// one of them is worth anyone's attention.
//
// Server-side only. Never import this from a client component.

/** Where founder mail arrives. A forwarder on the domain's MX records passes it to Gmail (spec 144). */
const DEFAULT_INBOX = "support@airrow.app";

/** Resend's verified sending identity for Airrow (spec 113 put DKIM on `send.airrow.app`). */
const DEFAULT_FROM = "Airrow <noreply@airrow.app>";

const ENDPOINT = "https://api.resend.com/emails";

export type MailResult =
  /** Accepted by Resend; `id` is what a delivery is looked up by. */
  | { status: "sent"; id: string }
  /** No API key — the ordinary state in development and in tests. Nothing was attempted. */
  | { status: "skipped" }
  /** Attempted and refused, or unreachable. `reason` is for the log, never for the founder. */
  | { status: "failed"; reason: string };

export interface MailMessage {
  subject: string;
  /** Plain text only. Nothing we send ourselves is worth giving injected markup a place to render. */
  text: string;
  /** The founder's address, so replying from the inbox reaches them. */
  replyTo?: string;
}

/**
 * Strip anything that could start a new header.
 *
 * The subject is built from a founder's own words, and a bare CR or LF in a header value is how a
 * second header gets smuggled into a message. Newlines are not meaningful in a subject line anyway,
 * so collapsing them costs nothing.
 */
const headerSafe = (value: string): string => value.replace(/[\r\n]+/g, " ").trim();

/** Where founder mail is delivered. Overridable so a staging deployment cannot mail the real inbox. */
export const supportInbox = (): string => process.env.SUPPORT_INBOX || DEFAULT_INBOX;

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: "skipped" };

  const replyTo = message.replyTo ? headerSafe(message.replyTo) : undefined;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM || DEFAULT_FROM,
        to: [supportInbox()],
        subject: headerSafe(message.subject),
        text: message.text,
        ...(replyTo ? { reply_to: replyTo } : {})
      })
    });

    if (!res.ok) return { status: "failed", reason: `resend ${res.status}` };

    const body: unknown = await res.json();
    const id =
      typeof body === "object" && body !== null && "id" in body && typeof body.id === "string"
        ? body.id
        : "";
    return { status: "sent", id };
  } catch (error) {
    // The network, a DNS failure, a timeout. The founder is already being told their message was
    // saved, so the only thing left to do with this is write it down.
    return { status: "failed", reason: error instanceof Error ? error.message : "unknown" };
  }
}
