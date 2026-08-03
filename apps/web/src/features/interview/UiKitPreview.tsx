"use client";

import { describeUiKit, type UiKit, type UiKitPalette } from "@airrow/schemas";

/**
 * What a curated design direction looks like (spec 165).
 *
 * **A specimen, not a screen.** The earlier version drew an application — a sidebar, a table, a row
 * of tiles — and that was the wrong promise: a founder picking a look was implicitly picking a
 * layout, and the first screen then had a sidebar whether or not their product wanted one. What is
 * shown here is the visual language and nothing else: the brand mark, the headline treatment, the
 * palette, the corner, the surface. What goes on their screens comes from what they wrote.
 *
 * Drawn from the same `UiKit` record `/start` writes into the founder's stylesheet, so the picture
 * and the theme are the same fact — a changed token changes the preview in the same commit — and the
 * caption is generated from that record too.
 */
export function UiKitPreview({ kit }: { kit: UiKit }) {
  // A real capture of this theme, when one has been taken. The drawing below is the fallback and is
  // always true, so a capture can be deleted rather than trusted stale.
  if (kit.screenshot) {
    return (
      <span className="block w-full">
        {/* Plain `img`: a fixed local asset, not user content, and the picker must not depend on the
            optimiser being reachable to render a question the interview cannot proceed without. */}
        <img
          src={kit.screenshot}
          alt={`${kit.name}: ${describeUiKit(kit)}`}
          width={400}
          height={260}
          className="block w-full"
        />
      </span>
    );
  }

  const p: UiKitPalette = kit.darkFirst ? kit.dark : kit.light;
  const d = kit.design;
  const r = radius(d.radius);
  const air = d.spacing === "airy" ? 30 : d.spacing === "balanced" ? 22 : 16;
  // How a surface is told apart from the ground: a hairline in the border colour, a single pixel in
  // the accent, or nothing at all — the panel's own fill against the page.
  const outline =
    d.surfaces === "hairline borders" ? p.border : d.surfaces === "single-pixel outlines" ? p.accent : null;

  const W = 400;
  const H = 260;

  return (
    <span aria-hidden="true" className="block w-full" style={{ borderBottom: `1px solid ${p.border}` }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto" role="presentation" style={{ display: "block" }}>
        <rect x="0" y="0" width={W} height={H} fill={p.bg} />

        {/* Composed the way this direction composes a first impression — see `UiKitDesign`. */}
        {d.composition === "centred" ? (
          <g>
            <Brand kind={d.logo} x={W / 2 - 46} y={30} palette={p} radius={r} />
            <rect x={W / 2 - 118} y={62} width={236} height={19} rx={Math.min(r, 4)} fill={p.fg} />
            <rect x={W / 2 - 82} y={88} width={164} height={19} rx={Math.min(r, 4)} fill={p.accent} />
            <rect x={W / 2 - 96} y={118} width={192} height={6} rx={3} fill={p.muted} opacity="0.55" />
            <rect x={W / 2 - 68} y={140} width={64} height={24} rx={Math.min(r * 1.4, 12)} fill={p.accent} />
            <rect x={W / 2 + 4} y={140} width={64} height={24} rx={Math.min(r * 1.4, 12)} fill="none" stroke={p.border} />
          </g>
        ) : d.composition === "terminal" ? (
          <g>
            <Brand kind={d.logo} x={air} y={28} palette={p} radius={r} />
            {/* One panel of output — the prompt is the brand and the result is the headline. */}
            <rect
              x={air}
              y={50}
              width={W - air * 2}
              height={150}
              rx={r}
              fill={p.surface}
              stroke={p.accent}
              strokeOpacity="0.3"
            />
            {[0, 1, 2, 3, 4, 5].map((i) => {
              const y = 70 + i * 21;
              const lead = i === 0 || i === 5;
              return (
                <g key={i}>
                  {lead ? <rect x={air + 16} y={y - 4} width={7} height={8} rx={1} fill={p.accent} /> : null}
                  <rect
                    x={air + 30}
                    y={y - 3}
                    width={i === 3 ? 128 : 88 + ((i * 37) % 120)}
                    height={7}
                    rx={1.5}
                    fill={i === 3 ? p.accent : lead ? p.fg : p.muted}
                    opacity={i === 3 || lead ? 0.95 : 0.45}
                  />
                  {i === 5 ? <rect x={air + 30 + 92} y={y - 4} width={6} height={9} fill={p.accent} /> : null}
                </g>
              );
            })}
          </g>
        ) : (
          <g>
            <Brand kind={d.logo} x={air} y={30} palette={p} radius={r} />
            <rect x={air} y={64} width={W - air * 2 - 70} height={18} rx={Math.min(r, 4)} fill={p.fg} />
            <rect x={air} y={90} width={W - air * 2 - 150} height={18} rx={Math.min(r, 4)} fill={p.fg} />
            <rect x={air} y={120} width={150} height={6} rx={3} fill={p.muted} opacity="0.6" />
            <rect x={air} y={134} width={112} height={6} rx={3} fill={p.muted} opacity="0.4" />
            <rect x={air} y={154} width={96} height={26} rx={Math.min(r * 1.4, 13)} fill={p.accent} />
          </g>
        )}

        {/* Three surfaces, separated the way this direction separates things. */}
        {d.composition !== "terminal"
          ? [0, 1, 2].map((i) => {
              const cw = (W - air * 2 - 20) / 3;
              const cx = air + i * (cw + 10);
              return (
                <g key={i}>
                  <rect
                    x={cx}
                    y={196}
                    width={cw}
                    height={44}
                    rx={r}
                    fill={p.surface}
                    stroke={outline ?? "none"}
                    strokeOpacity={outline === p.accent ? 0.3 : 1}
                  />
                  <rect x={cx + 12} y={208} width={cw * 0.4} height={5} rx={2.5} fill={p.muted} opacity="0.55" />
                  <rect x={cx + 12} y={222} width={cw * 0.66} height={7} rx={3.5} fill={p.fg} opacity="0.85" />
                </g>
              );
            })
          : null}

        {/* The palette itself, stated — it is most of what is being chosen. */}
        {d.composition !== "centred"
          ? [p.accent, p.fg, p.muted, p.border].map((c, i) => (
              <circle key={i} cx={W - air - 6 - i * 17} cy={30} r="6" fill={c} />
            ))
          : null}
      </svg>
    </span>
  );
}

/** The brand mark, in whichever of the three ways this direction leads with it. */
function Brand({
  kind,
  x,
  y,
  palette: p,
  radius: r
}: {
  kind: UiKit["design"]["logo"];
  x: number;
  y: number;
  palette: UiKitPalette;
  radius: number;
}) {
  // The mark itself, standing for the real artwork the capture uses — a diamond rather than a traced
  // logo, because a redrawn brand asset is a different brand asset.
  const mark = (size: number) => (
    <rect
      x={x}
      y={y - size / 2}
      width={size}
      height={size}
      rx={Math.min(r, size / 5)}
      fill={p.accent}
      transform={`rotate(45 ${x + size / 2} ${y})`}
    />
  );

  if (kind === "the mark alone") {
    // No wordmark at all: this direction's statement is that it does not need one.
    return mark(34);
  }
  if (kind === "mark and large wordmark") {
    return (
      <g>
        {mark(20)}
        <rect x={x + 30} y={y - 9} width="92" height="18" rx={Math.min(r, 4)} fill={p.fg} />
      </g>
    );
  }
  // Mark, then a prompt: a caret, a short word and a cursor.
  return (
    <g>
      {mark(16)}
      <rect x={x + 26} y={y - 4} width="8" height="8" rx="1" fill={p.accent} />
      <rect x={x + 40} y={y - 4} width="38" height="8" rx="1.5" fill={p.fg} opacity="0.9" />
      <rect x={x + 84} y={y - 5} width="6" height="10" fill={p.accent} />
    </g>
  );
}

/**
 * The theme's radius in the preview's own units.
 *
 * `design.radius` is written in `rem` because that is what goes into the stylesheet; the drawing is
 * a fixed 400-unit viewBox, so it needs a number. 16 px to the rem, scaled down because the preview
 * is about a third of life size and a radius drawn at full scale reads as a pill.
 */
function radius(value: string): number {
  const rem = Number.parseFloat(value);
  return Number.isFinite(rem) ? Math.min(rem * 16 * 0.55, 9) : 3;
}
