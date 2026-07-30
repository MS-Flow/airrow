// Where the founder stands, said before it stops them (spec 100).
//
// The limit was previously only ever mentioned at the moment it refused — which reads as a trap,
// however politely it is worded. This is the standing line that makes the refusal unsurprising, and
// it is deliberately quiet when there is nothing to warn about: a founder with allowance left does
// not need a banner about a wall they are nowhere near.
import Link from "next/link";
import type { Entitlement } from "./allowance";
import { FREE_GENERATION_LIMIT } from "./limits";

export function AllowanceNotice({
  allowance,
  className
}: {
  allowance: Entitlement;
  className?: string;
}) {
  // Pro and admin have no line to stand near; saying so would be noise on every screen.
  if (allowance.unlimited) return null;

  const spent = allowance.remaining === 0;

  return (
    <p className={className}>
      {spent ? (
        <>
          <span className="font-medium text-fg">
            You&rsquo;ve used your free{" "}
            {FREE_GENERATION_LIMIT === 1 ? "foundation" : "foundations"}.
          </span>{" "}
          <span className="text-fg-muted">
            You can still answer the interview — generating a new one needs Pro.
          </span>{" "}
          <Link href="/app/upgrade" className="text-fg underline underline-offset-4">
            See what Pro gives
          </Link>
        </>
      ) : (
        <span className="text-fg-muted">
          {allowance.remaining} of {FREE_GENERATION_LIMIT} free{" "}
          {FREE_GENERATION_LIMIT === 1 ? "foundation" : "foundations"} left on this workspace.
        </span>
      )}
    </p>
  );
}
