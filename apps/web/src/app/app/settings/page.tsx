// Settings: profile, theme, workspace, and every connection — the ones that exist and the ones that
// don't yet.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Github, ShieldCheck } from "lucide-react";
import { profileUpdateSchema } from "@airrow/schemas";
import { PageContainer } from "@/components/shell/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ComingSoon } from "@/components/ui/states";
import { ThemeToggle } from "@/features/settings/ThemeToggle";
import { signInWithGitHubAction } from "@/features/auth/actions";
import {
  FREE_GENERATION_LIMIT,
  FREE_REPAIR_LIMIT,
  REPAIR_WINDOW_HOURS,
  checkAllowance
} from "@/features/generation/allowance";
import {
  BillingUnavailable,
  ManageBillingButton,
  UpgradeButtons
} from "@/features/billing/BillingActions";
import { githubIdentity, requireSession, updateName } from "@/lib/auth";
import { getSubscription } from "@/lib/data/store";
import { stripeConfigured, stripePrices } from "@/lib/stripe";
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
  searchParams: Promise<{ saved?: string; upgraded?: string }>;
}) {
  const { saved, upgraded } = await searchParams;
  const { user, org } = await requireSession();
  const theme = await readTheme();
  const allowance = await checkAllowance({ orgId: org.id, plan: org.plan, userId: user.id });
  const subscription = org.plan === "pro" ? await getSubscription(org.id) : null;
  const intervals = stripePrices().map((p) => p.interval);
  const github = await githubIdentity();
  const githubConfigured = Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Settings</h1>
      <p className="mt-2 text-base text-fg-muted">Your account, workspace and connections.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            Profile
            {allowance.unlimited ? (
              <Badge tone="accent" className="inline-flex items-center gap-1">
                <ShieldCheck className="size-3.5" />
                Admin
              </Badge>
            ) : null}
          </CardTitle>
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

      {/* What is left, in the one place a founder looks when they wonder. Shown to everyone rather
          than only on the way out: a limit discovered at the moment it stops you reads as a trap. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardBody>
          {upgraded ? (
            <p className="mb-4 text-sm text-success">
              You&rsquo;re on Pro. If this still says Free, give Stripe a few seconds and reload —
              the plan changes when Stripe confirms the payment, not when your browser comes back.
            </p>
          ) : null}

          {allowance.unlimited ? (
            <>
              <p className="text-sm text-fg-muted">
                <span className="font-medium text-fg">
                  {allowance.allowed && allowance.grant === "pro" ? "Pro" : "Admin"}
                </span>{" "}
                · unlimited generations. {allowance.used} used so far.
              </p>
              {subscription ? (
                <>
                  <p className="mt-1.5 text-xs text-fg-faint">
                    {subscription.cancelAtPeriodEnd
                      ? "Cancelled — Pro runs until the end of the period you've paid for."
                      : "Renews automatically."}
                    {subscription.currentPeriodEnd
                      ? ` Current period ends ${subscription.currentPeriodEnd.slice(0, 10)}.`
                      : ""}
                  </p>
                  <ManageBillingButton />
                </>
              ) : null}
            </>
          ) : (
            <>
              <p className="text-sm text-fg-muted">
                <span className="font-medium text-fg">Free</span> · {allowance.remaining} of{" "}
                {FREE_GENERATION_LIMIT} {FREE_GENERATION_LIMIT === 1 ? "foundation" : "foundations"}{" "}
                left.
              </p>
              <p className="mt-1.5 text-xs text-fg-faint">
                Changed your mind about an answer? A foundation can be regenerated{" "}
                {FREE_REPAIR_LIMIT} times free within {REPAIR_WINDOW_HOURS} hours of its first run,
                and regenerating with nothing changed never costs anything. Deleting a project
                doesn&apos;t return a generation — each one is authored the moment you start it. Pro
                is unlimited and adds importing an existing project.
              </p>
              {stripeConfigured() ? (
                <UpgradeButtons intervals={intervals} />
              ) : (
                <BillingUnavailable />
              )}
            </>
          )}
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

      {/* Two GitHub connections, and they are not the same thing (spec 67). This one is the
          founder's own account: it signs them in and reads their public repositories. The App
          below writes, and does not exist yet. Showing them as one control made a founder who had
          just signed in with GitHub read "Not connected" about themselves. */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <Github className="size-4 text-fg-muted" />
            GitHub account
            <Badge tone={github ? "success" : "neutral"}>
              {github ? "Connected" : "Not connected"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          {github ? (
            <>
              <p className="max-w-md text-sm leading-relaxed text-fg-muted">
                Signed in as{" "}
                <span className="font-medium text-fg">
                  {github.login ? `@${github.login}` : user.email}
                </span>
                . Airrow reads your <strong className="font-medium text-fg">public</strong>{" "}
                repositories with this identity and asks GitHub for no repository permissions at all,
                so a private project stays invisible to it.
              </p>
              <Button variant="secondary" size="sm" asChild>
                <Link href="/app/projects/import">Import a repository</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="max-w-md text-sm leading-relaxed text-fg-muted">
                Connect GitHub to import a public repository without packing a ZIP. Airrow asks for no
                repository permissions, so it sees exactly what a signed-out visitor sees. If your
                GitHub address is the same as this account&rsquo;s, you land back in this workspace —
                a different address signs you into that account instead.
              </p>
              <form action={signInWithGitHubAction}>
                <Button type="submit" variant="secondary" size="sm">
                  <Github className="size-4" />
                  Sign in with GitHub
                </Button>
              </form>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <Github className="size-4 text-fg-muted" />
            GitHub App — repository delivery
            <Badge tone={githubConfigured ? "success" : "neutral"}>
              {githubConfigured ? "Configured" : "Not set up"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardBody className="flex flex-wrap items-start justify-between gap-4">
          <p className="max-w-md text-sm leading-relaxed text-fg-muted">
            One-click &quot;create repository and push&quot; for generated foundations, and the only
            way into a <strong className="font-medium text-fg">private</strong> repository. Writing
            anywhere needs a GitHub App — your sign-in above deliberately cannot. Requires{" "}
            <code className="font-mono text-xs">GITHUB_APP_ID</code>,{" "}
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
        {/* Pro is no longer listed here: it is real, and the Plan card above is where a founder
            buys and manages it (spec 99). Leaving a "coming soon" tile beside a working upgrade
            button would be the one thing on this page that contradicts another. */}
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
    </PageContainer>
  );
}
