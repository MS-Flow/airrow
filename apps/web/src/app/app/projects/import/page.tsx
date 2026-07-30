// Import an existing project — the alternative entry to the wizard, for a codebase that already
// exists. The interview still runs; the archive just answers the questions it can (spec 63).
import Link from "next/link";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Notice, UpgradeNotice } from "@/components/ui/states";
import { ImportForm } from "@/features/import/ImportForm";
import { RepoPicker } from "@/features/import/RepoPicker";
import { requireSession } from "@/lib/auth";
import { referralSummary } from "@/lib/data/referrals";

export const metadata = { title: "Import an existing project" };

/** Page number from the URL. Anything that isn't a page is page one, never an error. */
function pageNumber(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default async function ImportProject({
  searchParams
}: {
  searchParams: Promise<{ repoPage?: string }>;
}) {
  const { repoPage } = await searchParams;
  const { org } = await requireSession();
  // Read-only on purpose: a queued week must not start because somebody opened this page. It starts
  // when the import actually runs, which is what `claimPro` in the action does (spec 122).
  const referral = org.plan === "pro" ? null : await referralSummary(org.id);
  const pro = org.plan === "pro" || Boolean(referral?.activeUntil);

  return (
    <PageContainer className="max-w-xl animate-slide-up py-16">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs text-fg-faint">Step 1 of 2 — your project</p>
        <Progress value={50} aria-label="Setup progress" className="w-32" />
      </div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-fg">
        Bring a project you&rsquo;ve already started
      </h1>
      <p className="mt-2 text-base leading-relaxed text-fg-muted">
        Airrow reads your manifests and folder structure to answer what it can, then asks you the
        rest. Nothing is written over: anything Airrow generates that already exists in your project
        is shown as a conflict for you to decide.
      </p>

      {/* Said before the upload, not after it (spec 74). A founder who finds out at the end that
          the result needs a plan they don't have has been wasted, however good the result is. */}
      {pro ? null : referral && referral.queued > 0 ? (
        // A week they have already earned and not started. Saying "needs Pro" here would be true of
        // the plan and false of them — importing starts the week and simply works (spec 122).
        <Notice className="mt-6" title="Your free week of Pro starts here">
          You have {referral.queued === 1 ? "a week" : `${referral.queued} weeks`} of Pro waiting from
          an invitation. Importing this project starts the first one — nothing to pay, nothing to
          confirm.
        </Notice>
      ) : (
        <UpgradeNotice className="mt-6" title="Import is part of Pro">
          You can run the analysis now and see everything Airrow works out about your project —
          that&rsquo;s free, and nothing is stored. Turning it into a project needs Pro.
        </UpgradeNotice>
      )}

      <Notice className="mt-6" title="Leave secrets and personal data out of the archive">
        Airrow reads every file to work out what your project already has, and it does{" "}
        <strong className="font-medium text-fg">not</strong> scan for secrets — an{" "}
        <code className="font-mono text-2xs">.env</code> file, an API key or a{" "}
        <code className="font-mono text-2xs">.pem</code> certificate is uploaded like any other
        file, and a key that has left your machine has to be rotated. Airrow stores your project&rsquo;s
        structure and never its file contents; the{" "}
        <Link href="/privacy" className="underline underline-offset-4 hover:text-fg">
          privacy policy
        </Link>{" "}
        sets out exactly what that means.
      </Notice>

      <Card className="mt-4">
        <CardBody className="p-6">
          <ImportForm />
        </CardBody>
      </Card>

      <RepoPicker page={pageNumber(repoPage)} />

      <p className="mt-6 text-sm text-fg-faint">
        Starting from nothing instead?{" "}
        <Link href="/app/projects/new" className="text-fg-muted underline underline-offset-4 hover:text-fg">
          Create a new project
        </Link>
        .
      </p>
    </PageContainer>
  );
}
