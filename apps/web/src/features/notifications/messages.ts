// What Slack is told (spec 203) — the complete list, in one readable file.
//
// The same shape `features/analytics/events.ts` has for PostHog, and for the same reason: what leaves
// the building to a third party is a privacy question, and the honest way to answer it is to be able
// to point at a file. Three messages, and each names a workspace, sometimes a project, and nothing
// else. **No email address.** A Slack channel is searchable by everyone in the workspace and retained
// by Slack; who someone is belongs in the admin console, behind a login.
//
// Pure functions with no transport, so what is *said* is testable without a network.
import type { PaidTier } from "@/features/analytics/events";

/**
 * How long a founder-typed name may be in a message.
 *
 * Long enough for any real workspace; short enough that one founder cannot make the channel
 * unreadable for everyone by naming their project a paragraph.
 */
const MAX_NAME = 80;

/** Shown when a name is missing rather than dropping the message. A notification beats a blank. */
const UNNAMED = "(unnamed)";

/**
 * Make founder-typed text safe to put in a Slack message.
 *
 * Workspace and project names are untrusted (§III) — they are whatever someone typed into a form.
 * Slack's mrkdwn treats `<…>` as a link or a command, so a workspace named `<!channel>` would ping
 * everyone in the channel every time its owner created a project, and one named
 * `<https://evil.example|Payment failed>` would render as a link somebody might click. Escaping the
 * three characters Slack's own docs name is the whole fix.
 *
 * Truncated after escaping, so the cut can never land inside an entity and leave `&a` behind.
 */
export function escapeSlack(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.length > MAX_NAME ? `${escaped.slice(0, MAX_NAME)}…` : escaped;
}

/** A name as it should appear, escaped — or the placeholder when there isn't one. */
const named = (value: string | null | undefined): string =>
  value?.trim() ? escapeSlack(value.trim()) : UNNAMED;

/** How the account was created. Mirrors `SignupMethod`, in words rather than ids. */
const METHOD_LABEL: Record<string, string> = {
  email: "email",
  github: "GitHub",
  google: "Google"
};

export function userCreatedMessage(workspace: string | null, method: string): string {
  return `🎉 New account — *${named(workspace)}* signed up with ${METHOD_LABEL[method] ?? method}.`;
}

/** Where a project came from. The three paths that create one, in the founder's terms. */
export type ProjectOrigin = "new" | "imported" | "claimed";

const ORIGIN_LABEL: Record<ProjectOrigin, string> = {
  new: "started a project",
  imported: "imported a project",
  claimed: "finished the interview they started signed out"
};

export function projectCreatedMessage(
  workspace: string | null,
  project: string | null,
  origin: ProjectOrigin
): string {
  return `📁 *${named(workspace)}* ${ORIGIN_LABEL[origin]}: *${named(project)}*`;
}

/** What Pro was bought as. `founding` is the capped launch offer (spec 179). */
const TIER_LABEL: Record<PaidTier, string> = {
  monthly: "monthly",
  yearly: "yearly",
  founding: "a founding place"
};

export function paidMessage(workspace: string | null, tier: PaidTier): string {
  return `💚 *${named(workspace)}* bought Pro — ${TIER_LABEL[tier]}.`;
}
