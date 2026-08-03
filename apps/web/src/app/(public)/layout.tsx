// Everything a signed-out visitor can reach, and where the chat panel is mounted for them (spec 158).
//
// The route group is the point. Spec 141 hung the widget off the landing page, so it existed on `/`
// and nowhere else — including the pages where the question actually occurs to someone: the pricing
// section they just left, the terms they clicked through to, the sign-up form they are hesitating in
// front of. Mounting it here puts Archer on every public page. A route group changes no URL — `/`,
// `/login` and `/terms` are exactly where they were.
//
// It is no longer the *only* mount: spec 159 mounts the same panel from `app/app/layout.tsx` as well,
// so a signed-in founder can ask too. One mount per layout tree is still the rule — no page imports
// the widget itself.
import { ChatWidget } from "@/features/chat/ChatWidget";
import { startCtaHref } from "@/features/landing/start-cta";
import { getSession } from "@/lib/auth";

// `getSession()` hits Supabase over the network, and it now runs for every public page rather than
// only the landing one. Forcing dynamic skips Next's build-time static-generation probe, which would
// otherwise make that call during every build — the same reason and the same line the landing page
// carried before this layout existed. `getSession` is memoised per request, so a page that already
// asks pays nothing for asking here too.
export const dynamic = "force-dynamic";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <>
      {children}
      {/* Last in the tree and fixed to the corner, so it overlays the page instead of taking a
          place in it. */}
      <ChatWidget ctaHref={startCtaHref(Boolean(session))} />
    </>
  );
}
