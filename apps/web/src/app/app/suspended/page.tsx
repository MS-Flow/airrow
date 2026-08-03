// Where a suspended account lands (spec 164).
//
// Every `/app` route except this one and `/app/support` refuses through `requireSession`, and refusing
// used to mean a redirect to `/login` — a screen that tells someone their password is wrong when it is
// not, and that they cannot get past to ask. This page is the honest version of that refusal.
//
// It states no reason. The operator's note lives in `admin_audit_log`, written for us; the explanation
// a founder deserves is written for them, in the reply to the ticket this page exists to point at.
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionEvenIfSuspended } from "@/lib/auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Account suspended" };

export default async function SuspendedPage() {
  const { suspended } = await requireSessionEvenIfSuspended();
  // Reachable by anyone who types it, so an account in good standing is sent back rather than shown a
  // page about a state it is not in.
  if (!suspended) redirect("/app");

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Your account is suspended</h1>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-fg-muted">
        You can&rsquo;t use Airrow while this is in place. Nothing has been deleted — your projects and
        the foundations we built for you are exactly where you left them, and they come back with the
        account.
      </p>

      <Card className="mt-8 max-w-prose">
        <CardHeader>
          <CardTitle>Ask us about it</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-base leading-relaxed text-fg-muted">
            Support still works, and it is the way back. Tell us what you think happened and a real
            person will read it.
          </p>
          <Link
            href="/app/support"
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-sm font-medium text-fg transition-colors hover:text-fg-muted"
          >
            <LifeBuoy className="size-4" aria-hidden />
            Write to support
          </Link>
        </CardBody>
      </Card>
    </PageContainer>
  );
}
