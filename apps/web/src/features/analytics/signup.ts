// The moment an account becomes real (spec 182).
//
// There is no single line in the application where a signup happens: the workspace is provisioned by
// a Postgres trigger (`handle_new_user`), and what application code sees is a founder arriving at
// `/auth/callback` from GitHub or Google, or at `/auth/confirm` from a link in their inbox. Both of
// those routes also run for *returning* founders, every time they sign in.
//
// So the event is emitted from both, guarded on the account being new — the same test
// `attachPendingReferral` already applies for the same reason, and deliberately the same window, so
// the two never disagree about which accounts are fresh.
import { getOrgForUser } from "@/lib/data/store";
import { distinctIdForOrg } from "./events";
import { capture } from "./server";

/**
 * How new an account has to be for this to be its signup.
 *
 * Generous enough for a slow consent screen or a confirmation link opened in a second browser, far
 * short of a founder signing in next week. Erring long costs a duplicate on a chart; erring short
 * loses the top of the funnel for everyone on a bad connection.
 */
const NEW_ACCOUNT_MS = 10 * 60_000;

export type SignupMethod = "email" | "github" | "google";

/**
 * Record a signup, if this arrival is one. Never throws.
 *
 * Attributed to the **workspace**, not the user, so that the id on this event is the id on every
 * later one — `foundation_generated`, `zip_downloaded`, `paid` all name an organization, and a
 * funnel whose first step is keyed differently from its last is five counters in a trench coat.
 */
export async function captureSignup(
  user: { id: string; createdAt: string },
  method: SignupMethod
): Promise<void> {
  try {
    if (Date.now() - Date.parse(user.createdAt) > NEW_ACCOUNT_MS) return;

    // The workspace the trigger provisioned. Its absence means a half-created account, which is not
    // a signup to report yet.
    const org = await getOrgForUser(user.id);
    if (!org) return;

    capture("signup", distinctIdForOrg(org.id), { method });
  } catch {
    // Silent by contract. Nothing about measurement is worth failing the request in which somebody
    // finally got an account.
  }
}
