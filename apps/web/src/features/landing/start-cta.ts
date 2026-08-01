/**
 * Where "start a foundation" goes, for whoever is asking.
 *
 * Signed in, the real project form; signed out, the guest interview. It is one line, which is exactly
 * why it needs a home: the landing page's four CTAs and the chat panel's footer all point at it, and
 * the panel now renders on every public page (spec 158). Five copies of a ternary is five chances for
 * one of them to send a signed-in founder back through the signed-out flow.
 *
 * Beside `pro-cta.ts` and for the same reason it exists: a destination decided once, so two surfaces
 * cannot disagree about it.
 */
import { GUEST_INTERVIEW_PATH } from "@/features/interview/guest-route";
import { NEW_PROJECT_PATH } from "./pro-cta";

export function startCtaHref(signedIn: boolean): string {
  return signedIn ? NEW_PROJECT_PATH : GUEST_INTERVIEW_PATH;
}
