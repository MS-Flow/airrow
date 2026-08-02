// Where a reset link finishes (spec 171).
//
// Inside `/app`, so the middleware gate and `requireSession()` both apply — which is also what keeps a
// reset from being a way around a suspension: the per-request database read still sends a suspended
// founder to `/app/suspended`, password or no password (spec 164).
import Link from "next/link";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/states";
import { PasswordCard } from "@/features/auth/CredentialCards";
import { inRecovery } from "@/features/auth/recovery";
import { hasPassword, requireSession } from "@/lib/auth";

export const metadata = { title: "Choose a new password" };

export default async function PasswordPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; status?: string }>;
}) {
  const { error, status } = await searchParams;
  await requireSession();
  const recovery = await inRecovery();

  return (
    <PageContainer>
      {/* Just the word: the card below carries the heading that says which of the two arrivals this is,
          and a page that said it twice would read as two different instructions. */}
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Password</h1>

      {recovery ? null : (
        <Notice title="Nothing was reset" className="mt-4">
          That link has already been used, or the hour it lasts has passed — your current password still
          works. Change it below with the one you have, or{" "}
          <Link href="/forgot-password" className="font-medium text-fg underline-offset-4 hover:underline">
            send yourself another link
          </Link>
          .
        </Notice>
      )}

      <div className="mt-6">
        <PasswordCard recovery={recovery} hasPassword={await hasPassword()} error={error} status={status} />
      </div>

      <Button variant="ghost" size="sm" className="mt-4" asChild>
        <Link href="/app/settings">Back to settings</Link>
      </Button>
    </PageContainer>
  );
}
