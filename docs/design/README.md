# Design reference assets

Source images for [spec 19 — Premium Airrow UI](../../specs/19-premium-ui-system.md). These are
**reference material**, not shipped assets — the production logo lives as authored SVG in
`apps/web/src/components/brand/`.

| File | What it is | How to use it |
| ---- | ---------- | ------------- |
| `airrow-lockup.png` | Airrow mark + `AIRROW` wordmark, metallic on grey | **Copy exactly.** The source of truth for the logo. |
| `airrow-mark.png` | The mark on its own | **Copy exactly.** Trace this for the small/navbar variant. |
| `ref-odysseus-hero.png` | Odysseus AI hero (third-party site) | **Reference only** — hero structure, density, card rhythm. Do not copy. |
| `ref-odysseus-features.png` | Odysseus AI features grid (third-party site) | **Reference only** — icon-card grid, section pacing. Do not copy. Its mono-everything type and pink accent are explicitly *not* our direction. |

## How the app uses these

**These PNGs are already transparent** (RGBA, ~94–96 % fully transparent pixels). The grey most
viewers show is the viewer compositing alpha against a grey backdrop — it is not in the file. An
earlier attempt to hand-trace the mark as SVG was rejected for changing the design; the app now uses
**the artwork itself**.

The served copies live in `apps/web/public/brand/`, cropped to their alpha bounding box:

| Source | Served as | Size |
| ------ | --------- | ---- |
| `airrow-mark.png` | `public/brand/airrow-mark.png` | 526×495 |
| `airrow-lockup.png` | `public/brand/airrow-lockup.png` | 1135×301 |
| `airrow-mark.png` | `apps/web/src/app/icon.png` (favicon) | 256×241 |

**Cropping gotcha:** these renders carry a near-zero alpha wash (a glow) across the whole canvas, so a
bounding box taken at `alpha > 0` returns almost the full 1536×1024 frame. Use a threshold of ~16 to
find the solid artwork.

To re-crop after replacing a source file, the throwaway script is described in spec 19; it decodes the
PNG, takes the bbox above the threshold, box-filter downscales, and re-encodes. Both components size
by **height** (`h-*`), never `size-*`, because neither asset is square.

If the original **vector** ever turns up, drop it in as `airrow-mark.svg` — it would scale better and
could be recoloured per theme instead of relying on a CSS filter. Not required; the raster is exact.

## Notes for whoever authors the SVG

- **The two renders differ.** In `airrow-mark.png` the lower corners splay open into fine sharp
  points; in `airrow-lockup.png` the base is fuller and closes into a swept arc. **Trace the lockup
  version** — it is the form that appears next to the wordmark and therefore most often. Note the
  deviation if you pick the other one.
- **The glow and the grey backdrop are not the logo.** The mark is a silhouette with a metallic
  gradient fill; it must sit cleanly on `#09090B` with no baked-in halo.
- **Light theme needs its own fill.** A near-white metallic gradient disappears on a light
  background — the light-theme variant inverts to graphite-on-silver.
- **Small sizes drop the gradient.** Below ~24px the sheen turns to mud; the navbar/favicon variant
  is flat `currentColor`.
