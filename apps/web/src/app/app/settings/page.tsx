// Settings (F-406): profile, workspace, connections (GitHub stubbed per ADR-0005).
import { redirect } from "next/navigation";
import { Github } from "lucide-react";
import { profileUpdateSchema } from "@arrow/schemas";
import { Badge, Button, Card, Input, Label, Separator } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { updateUserName } from "@/lib/data/store";

async function updateProfileAction(formData: FormData) {
  "use server";
  const { user } = await requireSession();
  const parsed = profileUpdateSchema.safeParse({ name: formData.get("name") });
  if (parsed.success) updateUserName(user.id, parsed.data.name);
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
  const githubConfigured = Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="text-xl font-semibold tracking-tight text-fg">Settings</h1>
      <p className="mt-1 text-sm text-fg-muted">Your account, workspace, and connections.</p>

      <Card className="mt-8 p-6">
        <h2 className="text-sm font-semibold text-fg">Profile</h2>
        {saved ? <p className="mt-2 text-[13px] text-success">Saved.</p> : null}
        <form action={updateProfileAction} className="mt-4 max-w-sm space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" defaultValue={user.name} required maxLength={80} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} disabled />
            <p className="mt-1.5 text-xs text-fg-faint">
              Email is your identity in local mode and can&apos;t be changed here.
            </p>
          </div>
          <Button type="submit" size="sm">
            Save changes
          </Button>
        </form>
      </Card>

      <Card className="mt-4 p-6">
        <h2 className="text-sm font-semibold text-fg">Workspace</h2>
        <p className="mt-2 text-[13px] text-fg-muted">
          <span className="font-medium text-fg">{org.name}</span> · personal workspace. Teams and
          shared workspaces arrive with organizations (roadmap M7).
        </p>
      </Card>

      <Card className="mt-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Github className="mt-0.5 size-5 text-fg-muted" />
            <div>
              <h2 className="flex items-center gap-2.5 text-sm font-semibold text-fg">
                GitHub
                <Badge tone={githubConfigured ? "success" : "neutral"}>
                  {githubConfigured ? "Configured" : "Not connected"}
                </Badge>
              </h2>
              <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-fg-muted">
                One-click &quot;create repository and push&quot; for generated foundations. Requires
                registering a GitHub App and setting{" "}
                <code className="font-mono text-xs">GITHUB_APP_ID</code>,{" "}
                <code className="font-mono text-xs">GITHUB_APP_PRIVATE_KEY</code> and{" "}
                <code className="font-mono text-xs">GITHUB_APP_SLUG</code> in{" "}
                <code className="font-mono text-xs">.env</code>. Until then, ZIP download covers
                delivery.
              </p>
            </div>
          </div>
          <Button variant="secondary" size="sm" disabled title="Set GitHub App credentials in .env to enable">
            Connect
          </Button>
        </div>
      </Card>

      <Separator className="my-8" />

      <div className="rounded-lg border border-border bg-bg-subtle p-5">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Local mode
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-muted">
          Arrow is running fully on this machine (ADR-0005): data lives in{" "}
          <code className="font-mono text-xs">.data/</code> at the repository root, and document
          authoring uses the deterministic local agent. Adding Supabase keys and an{" "}
          <code className="font-mono text-xs">ANTHROPIC_API_KEY</code> to{" "}
          <code className="font-mono text-xs">.env</code> activates production auth, storage, and
          Claude-authored documents — see <code className="font-mono text-xs">.env.example</code>.
        </p>
      </div>
    </div>
  );
}
