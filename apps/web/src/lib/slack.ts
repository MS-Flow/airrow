// Posting to Slack (spec 203). Server-only, one webhook, one channel.
//
// An incoming webhook rather than a Slack app: the channel is fixed, the payload is one sentence, and
// a URL in the environment is the smallest credential that does the job. No bot token, no scopes,
// nothing to review, nothing to rotate beyond the URL itself.
//
// **Nothing here may fail its caller.** A signup, a project and a Stripe webhook each send one of
// these, and not one of them is worth failing over a chat message — a webhook that 500s because
// Slack was slow is a webhook Stripe retries, about a payment that already worked. So the signature
// returns `void` rather than a promise: a function nobody can await is a function nobody can
// accidentally put in the critical path of a payment.
import { escapeSlack } from "@/features/notifications/messages";

/**
 * Where messages go, or `null` on a deployment that is not notifying anyone.
 *
 * Trimmed, because a trailing newline survives a copy-paste out of Slack's own UI and is invisible
 * in a Vercel field. Checked for Slack's own host so a value pasted into the wrong variable fails
 * here, quietly and once, rather than posting our customers' workspace names to somebody else's
 * server.
 */
function webhookUrl(): string | null {
  const value = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!value) return null;
  return value.startsWith("https://hooks.slack.com/") ? value : null;
}

let warned = false;

/**
 * Send one line to Slack, and never let it matter.
 *
 * @param text already-built message. Escaping is the builder's job, not this function's — but the
 * `escapeSlack` import is deliberate: it keeps the two files a reviewer has to read together, and
 * makes it obvious that raw text is not what arrives here.
 */
export function notifySlack(text: string): void {
  const url = webhookUrl();
  if (!url) {
    if (!warned && process.env.SLACK_WEBHOOK_URL?.trim()) {
      warned = true;
      // Set but not a Slack URL — ours to fix, and silent failure is how it would stay unfixed.
      console.warn("SLACK_WEBHOOK_URL is set but is not a hooks.slack.com URL. Not notifying.");
    }
    return;
  }

  try {
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // `text` only. Blocks and attachments would let a message carry structure we would then be
      // tempted to fill, and one sentence is the whole product here.
      body: JSON.stringify({ text })
    }).catch(() => {
      // Swallowed rather than left to become an unhandled rejection, which in Node takes the process
      // with it. A launch spike rate-limited by Slack must not become an outage.
    });
  } catch {
    // `fetch` itself throwing is a malformed URL, which the check above already covers. Belt as well
    // as braces, because the alternative is an exception inside a Stripe webhook.
  }
}

export { escapeSlack };
