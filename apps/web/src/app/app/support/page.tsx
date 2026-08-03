// Support: the way to reach a human, from inside the app (spec 144).
//
// A Server Component with a plain form, like every other write in the app. The address is printed
// underneath on purpose — a founder whose ticket did not go through should not have to guess where
// else to write, and it costs one line to say it.
import { SUPPORT_CATEGORIES } from "@airrow/schemas";
import { PageContainer } from "@/components/shell/page-container";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InlineError, Notice } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { submitTicketAction } from "@/features/support/actions";
import { supportOverview } from "@/features/support/queries";
import { requireSessionEvenIfSuspended } from "@/lib/auth";
import { listProjects } from "@/lib/data/store";
import { TICKET_DAILY_LIMIT } from "@/lib/data/support";
import { supportInbox } from "@/lib/email";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Support" };

/** How each category reads to a founder. The stored value stays the short one. */
const CATEGORY_LABELS: Record<(typeof SUPPORT_CATEGORIES)[number], string> = {
  generation: "Generating a foundation",
  billing: "Billing and plans",
  account: "My account",
  other: "Something else"
};

export default async function SupportPage({
  searchParams
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  // The one page a suspension leaves standing (spec 164). The project picker stays: it is the founder's
  // own workspace, and a ticket that can name the project it is about is the difference between one
  // reply and three.
  const {
    session: { user, org }
  } = await requireSessionEvenIfSuspended();
  const [overview, projects] = await Promise.all([supportOverview(org.id), listProjects(org.id)]);
  const inbox = supportInbox();
  const canWrite = overview !== null && overview.remainingToday > 0;

  return (
    <PageContainer>
      <h1 className="text-2xl font-semibold tracking-tight text-fg">Support</h1>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-fg-muted">
        Tell us what happened and we&rsquo;ll reply to {user.email}. Generation that went wrong,
        a payment that looks off, anything at all — a real person reads every one of these.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Write to us</CardTitle>
        </CardHeader>
        <CardBody>
          {sent ? (
            <p className="mb-4 text-sm text-success">
              Sent. We&rsquo;ll reply to {user.email} — usually within a day.
            </p>
          ) : null}
          {error === "invalid" ? (
            <InlineError className="mb-4">
              A subject (at least 3 characters) and a description (at least 10) are required.
            </InlineError>
          ) : null}
          {error === "limit" ? (
            <Notice title="That is enough for today" className="mb-4" role="status">
              This workspace has opened {TICKET_DAILY_LIMIT} tickets in the last 24 hours. Nothing is
              lost — reply to the email thread on any of them and it reaches the same place.
            </Notice>
          ) : null}

          {overview === null ? (
            <Notice title="The form is temporarily unavailable">
              Write to <span className="font-medium text-fg">{inbox}</span> instead — it reaches
              exactly the same inbox, and we will not lose it.
            </Notice>
          ) : (
            <form action={submitTicketAction} className="max-w-xl space-y-5">
              <div>
                <Label htmlFor="category">What is this about?</Label>
                {/* Radix renders the hidden field this posts under `name`, so the form stays a form. */}
                <Select name="category" defaultValue="generation">
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {projects.length > 0 ? (
                <div>
                  <Label htmlFor="projectId">Which project? (optional)</Label>
                  <Select name="projectId" defaultValue="">
                    <SelectTrigger id="projectId">
                      <SelectValue placeholder="Not about a specific project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  name="subject"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="e.g. Generation failed halfway through"
                />
              </div>

              <div>
                <Label htmlFor="body">What happened?</Label>
                <Textarea
                  id="body"
                  name="body"
                  rows={6}
                  required
                  minLength={10}
                  maxLength={2000}
                  placeholder="What you did, what you expected, and what you got instead."
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-fg-faint">
                  Sent as {user.name} &lt;{user.email}&gt;.
                </p>
                <SubmitButton pendingLabel="Sending…" disabled={!canWrite}>
                  Send to support
                </SubmitButton>
              </div>
            </form>
          )}
        </CardBody>
      </Card>

      {overview && overview.tickets.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Your tickets</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3">
              {overview.tickets.map((ticket) => (
                <li key={ticket.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Badge tone={ticket.status === "open" ? "accent" : "neutral"}>
                    {ticket.status === "open" ? "Open" : "Closed"}
                  </Badge>
                  <span className="min-w-0 flex-1 text-sm text-fg">{ticket.subject}</span>
                  <span className="font-mono text-xs text-fg-faint">
                    {timeAgo(ticket.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <p className="mt-6 text-sm text-fg-faint">
        Prefer your own mail client? Write to{" "}
        <a
          href={`mailto:${inbox}`}
          className="text-fg-muted underline underline-offset-4 hover:text-fg"
        >
          {inbox}
        </a>{" "}
        — it reaches the same inbox.
      </p>
    </PageContainer>
  );
}
