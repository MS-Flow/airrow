// Settings: profile, theme, workspace, and every connection we don't have yet.
import { redirect } from "next/navigation";
import { Github } from "lucide-react";
import { profileUpdateSchema } from "@airrow/schemas";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComingSoon } from "@/components/ui/states";
import { ThemeToggle } from "@/features/settings/ThemeToggle";
import { requireSession, updateName } from "@/lib/auth";
import { readTheme } from "@/lib/theme";

async function updateProfileAction(formData: FormData) {
  "use server";
  await requireSession();
  const parsed = profileUpdateSchema.safeParse({ name: formData.get("name") });
  if (parsed.success) await updateName(parsed.data.name);
  redirect("/app/settings?saved=1");
}

export const metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const { user, org } = await requireSession();
  const theme = await readTheme();
  const githubConfigured = Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Settings</h1>
      <p className="mt-2 text-base text-fg-muted">Your account, workspace and connections.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardBody>
          {saved ? <p className="mb-4 text-sm text-success">Saved.</p> : null}
          <form action={updateProfileAction} className="max-w-sm space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={user.name} required maxLength={80} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user.email} disabled />
              <p className="mt-1.5 text-xs text-fg-faint">
                Email is managed by your account sign-in and can&apos;t be changed here.
              </p>
            </div>
            <Button type="submit" size="sm">
              Save changes
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardBody>
          <ThemeToggle current={theme} />
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-fg-muted">
            <span className="font-medium text-fg">{org.name}</span> · personal workspace.
          </p>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <Github className="size-4 text-fg-muted" />
            GitHub
            <Badge tone={githubConfigured ? "success" : "neutral"}>
              {githubConfigured ? "Configured" : "Not connected"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md text-sm leading-relaxed text-fg-muted">
            One-click &quot;create repository and push&quot; for generated foundations. Requires a
            GitHub App and <code className="font-mono text-xs">GITHUB_APP_ID</code>,{" "}
            <code className="font-mono text-xs">GITHUB_APP_PRIVATE_KEY</code> and{" "}
            <code className="font-mono text-xs">GITHUB_APP_SLUG</code> in{" "}
            <code className="font-mono text-xs">apps/web/.env.local</code>. Until then, ZIP download
            covers delivery.
          </p>
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Set GitHub App credentials in apps/web/.env.local to enable"
          >
            Connect
          </Button>
        </CardBody>
      </Card>

      {/* Surfaces with no backend yet — visible so the shape of the product is
          honest, disabled so nothing pretends to work. */}
      <div className="mt-4 space-y-3">
        <ComingSoon
          title="Azure DevOps"
          description="Push generated foundations to Azure Repos instead of GitHub."
        />
        <ComingSoon
          title="Organizations"
          description="Invite your team, share projects and set roles beyond your personal workspace."
        />
        <ComingSoon
          title="Billing"
          description="Plans, invoices and payment method, once pricing is set."
        />
        <ComingSoon
          title="API keys"
          description="Programmatic generation and CI integration for your own tooling."
        />
      </div>

      <div className="mt-8 rounded-lg border border-border bg-bg-subtle p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Environment
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          Accounts and project data are stored in Supabase (auth + Postgres with row-level security).
          Document authoring still uses the deterministic local agent; adding an{" "}
          <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> and GitHub App credentials to{" "}
          <code className="font-mono text-xs">apps/web/.env.local</code> activates Claude-authored
          documents and push-to-GitHub — see{" "}
          <code className="font-mono text-xs">apps/web/.env.example</code>.
        </p>
      </div>
    </div>
  );
}
