// Projects — what people actually built, and where the ones who stopped got to (spec 150).
//
// The interview is shown question by question rather than as raw jsonb. Those answers are customer IP
// (§II): they are here because supporting a founder whose generation went wrong is impossible without
// seeing what it was given, and for the same reason nothing on this path is ever logged. The privacy
// policy says so, in the change that added this screen.
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, InlineError, Notice } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { Pager } from "@/features/admin/Pager";
import { readableAnswers } from "@/features/admin/answers";
import { requireAdmin } from "@/lib/auth";
import { adminProject, adminProjects } from "@/lib/data/admin";
import type { ProjectStatus } from "@/lib/data/store";
import { cn, timeAgo } from "@/lib/utils";

const STATUSES: ProjectStatus[] = ["interviewing", "generating", "ready", "failed"];

const STATUS_TONES: Record<ProjectStatus, "neutral" | "info" | "success" | "danger"> = {
  interviewing: "neutral",
  generating: "info",
  ready: "success",
  failed: "danger"
};

type Origin = "imported" | "scratch";

// `as` justified in both: `includes` needs the wider value narrowed to ask the question, and the
// predicate is what the caller gets back — an untrusted search param never widens the filter type.
function isStatus(value: string | undefined): value is ProjectStatus {
  return STATUSES.includes(value as ProjectStatus);
}

function isOrigin(value: string | undefined): value is Origin {
  return value === "imported" || value === "scratch";
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md border px-2.5 py-1 text-sm transition-colors",
        active ? "border-border-strong bg-surface-raised text-fg" : "border-border text-fg-muted hover:text-fg"
      )}
    >
      {children}
    </Link>
  );
}

export default async function AdminProjectsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; origin?: string; page?: string; open?: string }>;
}) {
  const { status, origin, page: pageParam, open } = await searchParams;
  const { user: actor } = await requireAdmin();
  const page = Math.max(0, Number(pageParam ?? 0) || 0);

  const filters = {
    status: isStatus(status) ? status : undefined,
    origin: isOrigin(origin) ? origin : undefined
  };
  const projects = await adminProjects(actor.id, { ...filters, page });
  // The interview is only read for the one project an operator opened — it is the most sensitive thing
  // on the page, and fetching every founder's answers to render a list would be indefensible.
  const detail = open ? await adminProject(actor.id, open, readableAnswers) : null;

  const query = (over: Record<string, string | undefined>): string => {
    const search = new URLSearchParams();
    const merged = { status: filters.status, origin: filters.origin, ...over };
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value);
    const text = search.toString();
    return text ? `/app/admin/projects?${text}` : "/app/admin/projects";
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FilterLink href={query({ status: undefined })} active={!filters.status}>
          All statuses
        </FilterLink>
        {STATUSES.map((s) => (
          <FilterLink key={s} href={query({ status: s })} active={filters.status === s}>
            {s}
          </FilterLink>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <FilterLink href={query({ origin: undefined })} active={!filters.origin}>
          Any origin
        </FilterLink>
        <FilterLink href={query({ origin: "imported" })} active={filters.origin === "imported"}>
          Imported
        </FilterLink>
        <FilterLink href={query({ origin: "scratch" })} active={filters.origin === "scratch"}>
          From scratch
        </FilterLink>
      </div>

      {detail ? (
        <Card className="mb-4">
          <CardHeader className="flex flex-wrap items-center gap-3">
            <CardTitle>{detail.name}</CardTitle>
            <Badge tone={STATUS_TONES[detail.status]}>{detail.status}</Badge>
            <Badge tone="neutral">{detail.importKind ? `Imported (${detail.importKind})` : "From scratch"}</Badge>
            <Link href={query({ open: undefined })} className="ml-auto text-sm text-fg-muted hover:text-fg">
              Close
            </Link>
          </CardHeader>
          <CardBody>
            {detail.job?.rejectedAnswers ? (
              <Notice title="The answers were refused, not our failure" className="mb-4">
                The authoring layer would not build on these answers (spec 128). Questions to rewrite:{" "}
                <span className="font-medium text-fg">{detail.job.rejectedAnswers.join(", ")}</span>
              </Notice>
            ) : detail.job?.error ? (
              <InlineError className="mb-4">
                Failed on our side at stage {detail.job.stage ?? "unknown"}: {detail.job.error}
              </InlineError>
            ) : null}

            {detail.job ? (
              <p className="mb-4 text-sm text-fg-faint">
                Job {detail.job.id} · {detail.job.status} · stages done:{" "}
                {detail.job.stagesDone.length > 0 ? detail.job.stagesDone.join(" → ") : "none"}
                {detail.job.finishedAt ? ` · finished ${timeAgo(detail.job.finishedAt)}` : ""}
              </p>
            ) : (
              <p className="mb-4 text-sm text-fg-faint">No generation has been started on this project.</p>
            )}

            <h3 className="text-base font-semibold text-fg">The interview</h3>
            {detail.answers.length === 0 ? (
              <p className="mt-2 text-sm text-fg-faint">Nothing answered yet.</p>
            ) : (
              <dl className="mt-3 space-y-3">
                {detail.answers.map((answer) => (
                  <div key={answer.id}>
                    <dt className="text-sm font-medium text-fg-muted">{answer.question}</dt>
                    <dd className="mt-0.5 whitespace-pre-wrap text-sm text-fg">{answer.answer}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
      ) : null}

      {projects.items.length === 0 ? (
        <EmptyState title="No projects match" description="Try a different status or origin." />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Project</TableHeaderCell>
              <TableHeaderCell>Workspace</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Origin</TableHeaderCell>
              <TableHeaderCell>Generations</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Updated</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {projects.items.map((project) => (
              <TableRow key={project.id}>
                <TableCell>
                  <Link href={query({ open: project.id })} className="text-fg underline-offset-4 hover:underline">
                    {project.name}
                  </Link>
                </TableCell>
                <TableCell>{project.orgName ?? "—"}</TableCell>
                <TableCell>
                  <Badge tone={STATUS_TONES[project.status]}>{project.status}</Badge>
                </TableCell>
                <TableCell>{project.importKind ? `imported (${project.importKind})` : "scratch"}</TableCell>
                <TableCell>{project.generations}</TableCell>
                <TableCell>{timeAgo(project.createdAt)}</TableCell>
                <TableCell>{timeAgo(project.updatedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pager
        base="/app/admin/projects"
        params={{ status: filters.status, origin: filters.origin, open }}
        page={page}
        hasMore={projects.hasMore}
      />
    </>
  );
}
