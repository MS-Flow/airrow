import { BrandSplash } from "@/components/brand/splash";

/**
 * Shown while a top-level route renders on the server. The landing page reads the session
 * cookie, so it can never be static and always costs a round trip — without this, clicking
 * the logo out of the app looked like nothing had happened until the new page arrived.
 *
 * Routes with their own `loading.tsx` (everything under `/app`) keep theirs.
 */
export default function Loading() {
  return <BrandSplash />;
}
