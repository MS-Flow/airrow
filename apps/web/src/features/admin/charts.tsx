// The chart primitives the statistics screen is built from (spec 150).
//
// Server Components rendering plain HTML — no charting library, no client JS. Everything here is a
// magnitude comparison of a **single series**, which is what makes that possible and also what decides
// the colour: one hue for the data, identity carried by a written label beside every mark. There is no
// categorical palette anywhere on the page, so there is nothing for a colourblind reader to have to
// tell apart by hue.
//
// Colours are the design system's semantic tokens (§III), so light and dark are the same code. Status
// tokens are used in exactly one place — the failure split — where the categories genuinely *are*
// statuses, and there they are labelled as well as coloured.
//
// Numbers and labels wear text tokens rather than the series colour: the bar carries the magnitude,
// the text stays readable.
import { cn } from "@/lib/utils";

/** A headline number, and whether it is moving. */
export function StatTile({
  label,
  value,
  previous,
  hint
}: {
  label: string;
  value: number;
  /** The same measure over the preceding window. A number with no direction is not information. */
  previous?: number;
  hint?: string;
}) {
  const delta = previous === undefined ? null : value - previous;
  // A percentage against zero is meaningless, so a rise from nothing is reported as the count it is.
  const percent =
    previous === undefined || previous === 0 ? null : Math.round(((value - previous) / previous) * 100);

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
      <p className="text-xs font-medium uppercase tracking-wide text-fg-faint">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-fg">{value.toLocaleString()}</p>
      {delta !== null ? (
        <p className="mt-1 text-xs text-fg-muted">
          <span className={cn(delta > 0 && "text-success", delta < 0 && "text-danger")}>
            {delta > 0 ? "↑" : delta < 0 ? "↓" : "→"} {Math.abs(delta).toLocaleString()}
            {percent !== null ? ` (${Math.abs(percent)}%)` : ""}
          </span>{" "}
          vs previous period
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-xs text-fg-faint">{hint}</p> : null}
    </div>
  );
}

export interface BarDatum {
  label: string;
  value: number;
  /** Only for data whose categories genuinely are statuses. Everything else stays one hue. */
  tone?: "accent" | "success" | "danger" | "warn" | "info";
}

const TONE_FILLS: Record<NonNullable<BarDatum["tone"]>, string> = {
  accent: "bg-accent",
  success: "bg-success",
  danger: "bg-danger",
  warn: "bg-warn",
  info: "bg-info"
};

/**
 * Ranked magnitudes, one row each.
 *
 * A horizontal bar list rather than a pie or a donut: these are comparisons of magnitude, and length
 * against a common baseline is the one encoding people read accurately. Every bar is directly
 * labelled, so there is no legend and no lookup.
 */
export function BarList({
  title,
  data,
  empty = "Nothing yet."
}: {
  title: string;
  data: BarDatum[];
  empty?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-3 text-sm text-fg-faint">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {data.map((datum) => (
            <li key={datum.label} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3">
              <span className="truncate text-sm text-fg-muted" title={datum.label}>
                {datum.label}
              </span>
              {/* The track is the axis: a common baseline every bar starts from. */}
              <span className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                <span
                  className={cn("block h-full rounded-full", TONE_FILLS[datum.tone ?? "accent"])}
                  style={{ width: `${Math.max(2, (datum.value / max) * 100)}%` }}
                />
              </span>
              <span className="text-right text-sm tabular-nums text-fg">
                {datum.value.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One measure over the window, a column per day.
 *
 * Columns rather than a line: the series is a count of discrete events per day, and a line between
 * them implies a value at 3am that nothing measured. Empty days are real zeros — `generate_series` in
 * the migration is what guarantees they are present rather than missing — so a quiet week reads as a
 * quiet week instead of a gap.
 *
 * Hover carries the exact figure through the native `title`, which keeps this a Server Component. Only
 * the ends of the range are labelled: a date under all thirty columns is unreadable, and the shape is
 * what the chart is for.
 */
export function DaySeries({
  title,
  data,
  valueKey
}: {
  title: string;
  data: { day: string; signups: number; projects: number; generations: number; tickets: number }[];
  valueKey: "signups" | "projects" | "generations" | "tickets";
}) {
  const values = data.map((d) => d[valueKey]);
  const max = Math.max(1, ...values);
  const total = values.reduce((sum, v) => sum + v, 0);

  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-fg">{title}</h3>
        <span className="text-sm tabular-nums text-fg-muted">{total.toLocaleString()} total</span>
      </div>

      {data.length === 0 ? (
        <p className="mt-3 text-sm text-fg-faint">No data in this window.</p>
      ) : (
        <>
          {/* `gap-0.5` is the 2px surface gap that keeps adjacent columns from reading as one block. */}
          <div className="mt-4 flex h-24 items-end gap-0.5">
            {data.map((point) => (
              <span
                key={point.day}
                title={`${point.day}: ${point[valueKey]}`}
                className="flex-1 rounded-t-sm bg-accent"
                style={{
                  // A floor of 2px so a zero day is still a visible tick on the baseline rather than
                  // nothing at all — the absence of a column reads as missing data, not as zero.
                  height: point[valueKey] === 0 ? "2px" : `${Math.max(6, (point[valueKey] / max) * 100)}%`
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-fg-faint">
            <span>{data[0]?.day}</span>
            <span>{data[data.length - 1]?.day}</span>
          </div>
        </>
      )}
    </div>
  );
}
