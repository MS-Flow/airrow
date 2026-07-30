/**
 * Where the landing page's Pro action goes.
 *
 * It used to go wherever the free action went, which meant a visitor who had already spent their free
 * foundation pressed "Start with Pro" and landed on the new-project form: the one screen that cannot
 * help them, since the wall is at generate and they would meet it again thirty questions later.
 *
 * So the destination follows what the founder has, not which card they pressed:
 *
 * - Nothing generated yet, signed in or not: start the foundation. Nobody is asked to pay before the
 *   product has done anything for them, and free is the whole first foundation.
 * - A foundation already spent: the upgrade screen, directly. That is the screen the button is
 *   promising, and it handles the already-Pro case itself so it is never a dead end.
 *
 * Signed out we cannot know, and Pro cannot be bought without an account either way, so the guest
 * interview is both the honest answer and the one that leads somewhere.
 */
import type { Entitlement } from "@/features/generation/allowance";
import { GUEST_INTERVIEW_PATH } from "@/features/interview/guest-route";

export const UPGRADE_PATH = "/app/upgrade";
export const NEW_PROJECT_PATH = "/app/projects/new";

/**
 * @param allowance the signed-in organization's entitlement, or `null` when nobody is signed in.
 *
 * Takes the whole `Entitlement` rather than a count, for the reason `AllowanceNotice` does: reading
 * `used` off the same value every other allowance surface reads means this link cannot drift from
 * what the founder is being told one section higher up the page.
 */
export function proCtaHref(allowance: Entitlement | null): string {
  if (!allowance) return GUEST_INTERVIEW_PATH;
  return allowance.used > 0 ? UPGRADE_PATH : NEW_PROJECT_PATH;
}
