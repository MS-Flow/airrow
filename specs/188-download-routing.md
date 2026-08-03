# Spec 188 — A download button that downloads

> **In one sentence:** "Download project" opens a file picker asking for an archive that never
> existed whenever the project was imported from a repository rather than a ZIP — because the button
> is chosen by *was this imported* instead of *is a merge possible*.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | 🔄 In progress                       |
| **Issue**      | [#188](https://github.com/MS-Flow/airrow/issues/188) — "Download project is a dead end for a repo-imported project — it asks for an archive that never existed" |
| **Branch**     | `188-download-routing` (from `feature/import-existing-projects`) |
| **Feature**    | Import existing projects             |
| **Depends on** | [68-workspace-tree-merged-zip.md](68-workspace-tree-merged-zip.md) — the browser-side merge and the IndexedDB cache · [67-github-login-import.md](67-github-login-import.md) — the repo import path that caches nothing · [63-import-existing-projects.md](63-import-existing-projects.md) — the promise that an import never hands back additions dressed up as the whole project |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

<!--
Status legend: ⏳ Not started · 🔄 In progress · ✅ Done
Mark anything undecided inline with [NEEDS CLARIFICATION: …] so /clarify can find it.
-->

---

## User story

_Who wants this, and what they get out of it._

As a **founder who imported my project from GitHub** I want **the download button to download**
so that **I get my foundation instead of a file picker demanding an archive I never had.**

---

## Background

_Filled in during `/implement`, grounded in `file:line`._

- **Today:** [`DownloadProject.tsx:18`](../apps/web/src/features/import/DownloadProject.tsx#L18)
  branches on one question — did `getImportSource()` return a row? No row means a plain
  `<a href="/api/projects/[id]/zip">` that simply downloads. A row means
  [`MergedDownload`](../apps/web/src/features/import/MergedDownload.tsx), which merges the founder's
  own files with Airrow's **in the browser**, because Airrow stores only digests and cannot build
  that archive server-side (spec 63, §II).
- **The problem:** the merge needs the founder's archive out of IndexedDB, and `cacheArchive` is
  called from exactly one place —
  [`ImportForm.tsx:41`](../apps/web/src/features/import/ImportForm.tsx#L41), the **ZIP upload** form.
  [`RepoImport.tsx`](../apps/web/src/features/import/RepoImport.tsx) reads the repository
  server-side and redirects straight to the interview, caching nothing. So for every repo import
  `hasCachedArchive` is permanently false and
  [`MergedDownload.tsx:112`](../apps/web/src/features/import/MergedDownload.tsx#L112) opens the
  picker on every press, asking for a file that cannot exist. The only way through is to download a
  ZIP of your own repository from GitHub and hand it back.
- **Also affected, for the same reason:** a ZIP import opened in a different browser or on a second
  machine, and one whose cache the browser evicted. Those at least *had* an archive once; the repo
  import never did.
- **Already in place:** the plain route
  ([`zip/route.ts`](../apps/web/src/app/api/projects/%5Bid%5D/zip/route.ts)) always works, needs no
  browser state, and already respects the founder's conflict decisions through `applyResolutions`.
  `ImportSourceRecord.kind` already records `zip` vs `repo`, which is the fact the routing turns on.
  Spec 187 adds `ImportSourceRecord.delivery` for the hidden cell, but has not landed on the shared
  feature branch yet — see _Implementation notes_.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**Route on whether a merge is possible and wanted, not on whether the project was imported.** The
merge exists to keep spec 63's promise — never hand back Airrow's additions dressed up as the whole
project — and that promise only has teeth when Airrow is the *only* place the founder's files could
come from. That is true of a ZIP upload and of nothing else:

- **Repo import** — the founder's code is in a repository they control and already have checked out.
  Handing them the foundation to drop into it is the useful answer, not a demand for a ZIP of the
  thing they already own.
- **Hidden delivery (spec 187)** — nothing collides, so there is nothing to merge. The foundation is
  a self-contained folder to unzip into an existing checkout. This holds **even for a ZIP import
  whose archive is cached**: the founder is working in their real checkout, and rebuilding a copy of
  their tree around the folder is not what they asked for. The layout wins over the source.
- **ZIP import with no cached archive** — the merge is wanted but not currently possible. This is the
  one case where asking is right, because the founder really did hand Airrow a ZIP and really would
  be short-changed by a foundation-only download they mistook for the whole project.

**A foundation-only download must say so, in the label.** The failure this spec fixes is a button
that lies about what it will do; replacing it with a button that quietly hands over less would be
the same bug with better manners. So the label itself changes — **"Download foundation"** — because
explaining the contents *only* in supporting copy would lean on a sentence people skim, and the
promise this has to keep is exactly the one skimming breaks.

A line beneath saying where it goes ("unzip it into your project") comes with it, but is **opt-in per
placement**: every current placement is a tight row of buttons, and spec 68 already established that
a header row cannot hold a paragraph. The label ships everywhere; the line ships where there is room.
See _Implementation notes_.

**A repo import gets that and nothing else** — no secondary "I have a ZIP of my repo, merge it for
me". They have the repository checked out already; unzipping a folder into it is an ordinary thing
to do, and a control almost nobody presses is worse than no control.

**A ZIP import with a cold cache keeps the picker, and gains a way past it.** Asking is still right
and still primary — that founder handed Airrow a ZIP and would be short-changed by a silent
foundation-only download. But "ask, or nothing" leaves someone on a second machine in exactly the
dead end this spec exists to remove, one step later. A secondary link takes the foundation alone,
so the answer to "I don't have that archive here" is never "then you get nothing".

**Not touched:** the merge itself — `build()`, the overlap warning and the "cleared between mount and
click" recovery are all correct and stay exactly as they are, as do their four tests. The ZIP route,
`applyResolutions`, and the digest-only storage decision are untouched.

`MergedDownload` **is** edited, in one place: the cold-cache escape hatch above is a second control
in the component that knows the cache is cold, so it belongs there rather than in the router. That is
an addition beside the picker, not a change to how the merge behaves — and the existing four tests
passing unedited is what proves the distinction held.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] A **repo-imported** project's download button downloads the foundation directly — no file
      picker, no browser-cache dependency, on the first press and every press.
- [x] A **ZIP-imported** project with a cached archive still gets the merged download, unchanged:
      the founder's files plus Airrow's, with conflict decisions respected.
- [x] A **ZIP-imported** project with no cached archive still asks for the archive as its primary
      action, and still says why — that path is correct today and stays.
- [x] That same founder also gets a **secondary way to take the foundation alone**, so "this browser
      doesn't have your archive" never means "then you get nothing". Secondary, never primary: the
      merge is still what they asked for.
- [ ] A **hidden** delivery (spec 187) downloads the foundation directly whatever the import source
      — including a ZIP import whose archive *is* cached. The layout decides, not the source.
      **Deferred:** spec 187 has not landed on `feature/import-existing-projects` yet, so
      `ImportSourceRecord.delivery` does not exist on this branch. See _Implementation notes_.
- [x] A project that was never imported is unaffected — still the plain link.
- [x] A repo import offers **no** merge path at all: one button, and it downloads.
- [x] Wherever the download is the foundation alone the button reads **"Download foundation"**, with
      a line saying where it goes — the contents are in the label, not only in copy beneath it, so a
      foundation-only ZIP is never mistaken for the whole project (spec 63's promise, which this must
      not quietly break while fixing the button).
- [x] The routing decision is covered by a test that fails before the fix — one case per import
      source, plus what each control is labelled. This is the layer that had no test at all, which is
      why the defect shipped. (Cache state is not a routing input — `DownloadProject` never consults
      it — so it is covered where it belongs, in `MergedDownload.test.tsx`.)
- [x] `MergedDownload`'s four existing tests still pass **unedited**, proving the merge behaviour was
      not disturbed while the routing above it changed and the escape hatch was added beside it.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `apps/web/src/features/import/DownloadProject.test.tsx` (8): the routing matrix as
  it exists on this branch — no import source / `zip` / `repo` — asserting which control is rendered,
  what its label says, whether the explanatory line appears, and that the imported paths are read
  only for the import that can use them. Written to fail against the unfixed `DownloadProject` first
  (4 of 8 did), per §V. The **hidden** column is deferred with the criterion above; see
  _Implementation notes_.
- **Extended** — `MergedDownload.test.tsx`: the cold-cache escape hatch is offered, is secondary to
  the picker, and downloads without asking for a file.
- **Unchanged** — the four existing `MergedDownload.test.tsx` cases must stay green with no edits to
  them; if one needs changing, the merge was disturbed and the change is wrong.
- **Manual run, in the spec** — import a real public repository, generate, press Download, and show
  a ZIP arriving with no picker. Then the same for a ZIP import, showing the merge still produces
  the founder's files plus Airrow's.
- Full suite result + typecheck/lint status.

---

## Exact changes (file:line)

_Filled in by `/implement`. The shape, so the plan has somewhere to start:_

1. **`apps/web/src/features/import/DownloadProject.tsx`** — route on `source.kind` and
   `source.delivery`, not on `source !== null`. This is the whole defect.
2. **The foundation-only button** — `"Download foundation"` plus the line beneath it. One component,
   used by both the never-imported branch and the new ones, so the label and its explanation cannot
   drift apart (§IV, a fact in one place).
3. **`apps/web/src/features/import/MergedDownload.tsx`** — the secondary foundation-only link, shown
   only when the cache is cold. Beside the picker; `build()` untouched.
4. **`apps/web/src/features/import/DownloadProject.test.tsx`** (new) — the routing matrix.
5. **`apps/web/src/features/import/MergedDownload.test.tsx`** — the escape hatch, added beside the
   four existing cases rather than editing any of them.
6. **`docs/architecture/SYSTEM_OVERVIEW.md`** — the delivery step described the defect as if it were
   the design ("the download is assembled in the browser", full stop). Rewritten to say which of the
   two downloads a project gets and why, in the same change as the code (§IV).

**No change needed:** the ZIP route, `applyResolutions`, `archive-cache.ts`, and the merge itself.

---

## Data model

**No schema changes.** Both facts the routing needs — `import_sources.kind` (spec 63) and
`delivery_layout` (spec 187) — are already stored and already read back on `ImportSourceRecord`.

---

## Security

Nothing security-relevant: this changes which of two existing, already-authorized download paths a
founder is handed. The ZIP route is org-scoped through `getProject` and unchanged, and no new data
crosses a boundary — if anything the fix removes a prompt that invites founders to re-upload their
own source code for no reason.

---

## Edge cases

_Unusual inputs or states, and what should happen._

- **ZIP import opened on a second machine** → no cached archive, so it asks, and offers the
  foundation alone as a way past. The copy makes it obvious *why* this browser cannot help, rather
  than implying something is broken.
- **Repo import where the founder wants everything in one archive** → not offered. They have the
  repository; unzipping the foundation into it is the answer, and the label says so.
- **Hidden delivery from a ZIP import** → foundation-only, because nothing collides. The founder's
  archive is irrelevant even though it exists — the layout decides.
- **Import source row exists but the generation failed** → out of scope here; the download button is
  not rendered without a completed artifact.
- **`kind` is a value neither branch expects** → fall back to the merged path, which asks rather than
  silently handing over less than the founder expects.

---

## Implementation notes

### The flake was caught, and it was not what anyone guessed

`MergedDownload > opens the file picker on the first click` had failed intermittently since spec
187's verification — once in ten runs, never in isolation, and not under six concurrent suites. The
guess recorded there was CPU contention. It was wrong.

Caught on the sixth consecutive full run: Radix Toast renders its message **twice** on purpose —
visibly, and again into an `aria-live` region for screen readers — and populates that region on a
timer. The assertion used `getByText`, which throws on two matches. So the test passed or failed
purely on whether it won the race against Radix's announce delay. Both copies are correct; asserting
on exactly one of them was the bug.

Fixed to `getAllByText(...).length` with the reason written next to it. **Eight consecutive full-suite
runs clean** afterwards, against a baseline that reproduced within six.

Pre-existing and unrelated to the routing defect, but fixed here rather than filed: it is one
assertion in a file this spec already edits, and §V does not let a failing test merge.

### The explanatory line could not go where the clarification put it

`/clarify` settled on "Download foundation" plus a line beneath saying where it goes. Every current
placement of this button is a tight flex row — the preview header, the project page's action row,
the continue page's footer — and spec 68 had already met that constraint and recorded the answer: a
header row cannot hold a paragraph.

So the label change ships everywhere (it is the load-bearing half, and survives a founder who reads
nothing else), and the line is opt-in via an `explain` prop, passed only by the continue page — the
one placement with vertical room, and the screen where "what do I do with this file" is the actual
question. A test asserts the line is *absent* from the default placements, so the constraint is held
by the suite rather than by memory.

The same constraint reshaped the cold-cache escape hatch: it is a compact "Foundation only" link on
the same line as the button, not the paragraph the spec first described. Why the picker opens at all
is still said through the toaster, which is spec 68's own answer to exactly this.

### Hidden layout: deferred, not forgotten

Spec 187 adds `ImportSourceRecord.delivery`, which does not exist on this branch, so the hidden cell
of the routing matrix cannot be written here. The routing is a single `if` on `source.kind` in one
function, so wiring it is one condition and one test case.

The two specs were cut from different feature branches — 187 from `feature/pro`, this one from
`feature/import-existing-projects` — which would have meant waiting for both to reach `develop`.
Spec 187 has since **moved to `feature/import-existing-projects`**, because importing is already Pro
and every line it touches is import code. So the two now share a feature branch and meet a step
earlier: **whichever of them merges there second owns the wiring**, and this note is the record that
it is owed.

### `/analyze` — 2026-08-03: three findings, all fixed

The first cross-check failed on four categories. Recorded, because two were spec text that had
drifted from the code and one was documentation still describing the defect as the design.

**1. `SYSTEM_OVERVIEW.md` documented the bug.** Its delivery step said the download "is assembled in
the browser" with no qualification, and that a missing archive means "the founder is asked to pick it
again" — a faithful description of the behaviour this spec exists to remove. §IV requires docs to
move in the same change as the code; they had not. Rewritten to say which of the two downloads a
project gets and why.

**2. A ticked criterion had clauses nobody had checked.** It claimed the routing test covered "one
case per source, per spec 187's layout, and per cache state". The layout column cannot exist on this
branch, and cache state is not a routing input at all — `DownloadProject` never consults it. The
criterion now describes what the test actually asserts, and says where cache state is covered
instead.

**3. Verification claimed a matrix half of which does not exist.** Same root as 2; corrected to the
matrix as it stands, with the hidden column deferred alongside its criterion.

### Verification — 2026-08-03

| Command | Result |
| --- | --- |
| `pnpm -r typecheck` | clean (3 projects) |
| `pnpm -r lint` | clean, no new issues (3 projects) |
| `pnpm -r test` | **1438 green**, 0 skipped — schemas 113, engine 305, web 1020 |
| `pnpm test:scripts` | 114 green, **1 pre-existing failure** |
| `pnpm --filter web build` | clean |

New tests: `DownloadProject.test.tsx` (8), verified to fail 4/8 against the unfixed routing before
the change, per §V. `MergedDownload.test.tsx` gained 3 cases for the escape hatch with **no edits to
its four existing ones** — 40 insertions, 0 deletions — which is what proves the merge itself was
not disturbed.

The pre-existing failure is `scripts/capture-ui-kit-previews.test.mjs` (spec 165), confirmed
unrelated during spec 187's verification by stashing and re-running.

**Outstanding: the manual run.** The Verification section asks for a real repository import driven
through the browser, and it has not been done — every repo-import criterion is currently proven by
unit test alone. That is worth naming rather than glossing: the defect this spec fixes was a routing
decision no test covered, and it was found by a founder pressing the button, not by the suite. A
green suite is exactly what was in place while it shipped.

**A false positive worth knowing about:** the design-token guard flagged
`features/import/DownloadProject.tsx:12` as a raw hex colour. It was the issue reference `(#188)` —
three hex digits behind a `#`. Reworded to `(spec 188)`, which is the house style anyway.

## Out of scope

_Deliberately excluded, so nobody wonders whether it was forgotten._

- Changing how the merge works, or what it produces. Only who is routed to it.
- Storing the founder's source so the server could build the merged archive — the digest-only design
  is deliberate (spec 63, §II) and this bug is not a reason to revisit it.
- Delivering back as a pull request, which still waits on the GitHub App integration.
- Nothing further in `MergedDownload` beyond the escape hatch. Its `picker?.addEventListener`, which
  would silently attach nothing on a null lookup, is a diagnostic weakness worth its own issue — but
  it was **not** the cause of the intermittent failure, which is fixed here (see
  _Implementation notes_).
