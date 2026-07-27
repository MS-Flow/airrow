// Import an existing project — the alternative entry to the wizard, for a codebase that already
// exists. The interview still runs; the archive just answers the questions it can (spec 63).
import Link from "next/link";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardBody } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ComingSoon, Notice } from "@/components/ui/states";
import { ImportForm } from "@/features/import/ImportForm";

export const metadata = { title: "Import an existing project" };

export default function ImportProject() {
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

      <ComingSoon
        className="mt-6"
        title="Import straight from GitHub"
        description="Connecting a repository through the Airrow GitHub App — and opening a pull request back into it — arrives with the GitHub App integration. Until then, upload an archive."
      />

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
