// Statistics — where people stop, and whether that is getting better (spec 150).
//
// Every number here is computed in Postgres by the functions in
// `20260801130000_admin_console.sql`, and every one of them comes from rows that exist because the
// product works. **There is no third-party script and no cookie on this page** — visitor measurement
// is a separate issue precisely so that the choice about cookies is made on its own terms.
//
// Each figure is shown against the preceding window of the same length, because a count with no
// direction cannot tell you whether to do anything about it.
import Link from "next/link";
import { BarList, DaySeries, StatTile } from "@/features/admin/charts";
import { requireAdmin } from "@/lib/auth";
import { adminStats } from "@/lib/data/admin";
import { cn } from "@/lib/utils";

const WINDOWS = [7, 30, 90];

export default async function AdminStatsPage({
  searchParams
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: daysParam } = await searchParams;
  const { user: actor } = await requireAdmin();
  const days = WINDOWS.includes(Number(daysParam)) ? Number(daysParam) : 30;

  const stats = await adminStats(actor.id, { days });
  const { current, previous, standing } = stats;

  // Activation is the funnel this product lives or dies by: an account, then a project, then a
  // finished interview, then a generation actually spent.
  const activation = [
    { label: "Signed up", value: current.signups },
    { label: "Created a project", value: current.projects },
    { label: "Finished the interview", value: current.interviewsCompleted },
    { label: "Used a generation", value: current.generations }
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {WINDOWS.map((w) => (
          <Link
            key={w}
            href={`/app/admin/stats?days=${w}`}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm transition-colors",
              days === w
                ? "border-border-strong bg-surface-raised text-fg"
                : "border-border text-fg-muted hover:text-fg"
            )}
          >
            {w} days
          </Link>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Signups" value={current.signups} previous={previous.signups} />
        <StatTile label="Projects" value={current.projects} previous={previous.projects} />
        <StatTile label="Generations" value={current.generations} previous={previous.generations} />
        <StatTile label="Tickets" value={current.tickets} previous={previous.tickets} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <DaySeries title="Signups per day" data={stats.series} valueKey="signups" />
        <DaySeries title="Generations per day" data={stats.series} valueKey="generations" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <BarList title="Activation" data={activation} />
        <BarList
          title="Where projects stand"
          data={stats.projectStatus.map((row) => ({
            label: row.status,
            value: row.total,
            // The one place status tokens are used, because these categories genuinely are statuses —
            // and each is labelled, so the colour is reinforcement rather than the only signal.
            tone:
              row.status === "ready"
                ? ("success" as const)
                : row.status === "failed"
                  ? ("danger" as const)
                  : row.status === "generating"
                    ? ("info" as const)
                    : ("accent" as const)
          }))}
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <BarList
          title="How far the stuck ones got"
          data={stats.interviewProgress.map((row) => ({
            label: `${row.answered} answered`,
            value: row.total
          }))}
          empty="Nobody is stuck mid-interview."
        />
        <BarList
          title="Failed generations"
          data={[
            { label: "Our fault", value: current.failuresOurs, tone: "danger" as const },
            { label: "Answers refused", value: current.failuresRejected, tone: "warn" as const }
          ]}
          empty="Nothing failed in this window."
        />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <BarList
          title="Tickets by category"
          data={stats.ticketCategories.map((row) => ({ label: row.category, value: row.total }))}
          empty="No tickets in this window."
        />
        <BarList
          title="Ratings"
          data={stats.reviewDistribution.map((row) => ({
            label: `${row.rating}★`,
            value: row.total
          }))}
          empty="No reviews yet."
        />
      </div>

      <h2 className="mt-8 text-md font-semibold text-fg">Invites</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Invites attached" value={current.invitesCreated} previous={previous.invitesCreated} />
        <StatTile
          label="Invites matured"
          value={current.invitesMatured}
          previous={previous.invitesMatured}
          hint="The invited founder generated a foundation."
        />
        <StatTile
          label="Weeks of Pro given"
          value={current.grantWeeks}
          previous={previous.grantWeeks}
          hint="What the programme has cost us."
        />
        <StatTile label="Weeks running now" value={standing.grantsActive} />
      </div>

      <h2 className="mt-8 text-md font-semibold text-fg">Right now</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Pro workspaces" value={standing.proOrgs} />
        <StatTile label="Free workspaces" value={standing.freeOrgs} />
        <StatTile label="Subscriptions active" value={standing.subsActive} />
        <StatTile
          label="Cancelling"
          value={standing.subsCancelling}
          hint="Active, but set to end at the period."
        />
        <StatTile label="Open tickets" value={standing.ticketsOpen} />
        <StatTile label="Unspent credits" value={standing.creditsUnspent} />
        <StatTile
          label="Reviews consented"
          value={standing.reviewsConsented}
          hint="Founders who said we may quote them."
        />
        <StatTile label="Reviews published" value={standing.reviewsPublished} />
      </div>

      <p className="mt-8 text-xs text-fg-faint">
        Everything above is derived from the database. Airrow runs no analytics script and sets no
        tracking cookie, which is why there is no consent banner — so these numbers describe accounts
        and what they did, never anonymous visits.
      </p>
    </>
  );
}
