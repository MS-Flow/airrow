# Spec 23 — Landing copy, the spec-driven story, smooth scroll and a real footer

> **In one sentence:** The landing page should talk about "AI agents" rather than Claude Code, drop the
> em-dash tell from its copy, show how spec-driven development actually works instead of promising
> samples, scroll gently instead of snapping when you press "See how it works", and carry a footer
> with the legal pages a real site is expected to have.

|                |                                                   |
| -------------- | ------------------------------------------------- |
| **Status**     | 🔄 In progress                                    |
| **Issue**      | #23 — "fix boiler text and small ui fix"          |
| **Branch**     | `23-landing-copy-footer` (from `feature/ui`)      |
| **Feature**    | UI / marketing surface                            |
| **Depends on** | [11-ui-design-flaws.md](11-ui-design-flaws.md) (landing page in its current shape) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As a **founder landing on airrow.app for the first time** I want **copy that doesn't assume one
specific AI tool and doesn't read as machine-written, a look at what Airrow actually produces, a hero
link that glides me into the explanation, and a footer with the usual legal pages** so that **Airrow
reads as a finished, trustworthy product rather than a demo.**

---

## Background

_How things work today and what's wrong with that — grounded in real code (`file:line` links added
during `/implement`)._

- **Today:** the landing page lives in a single server component,
  [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx). It named Claude Code in three places — the
  step-03 card title and body, the hero paragraph and the mono strapline — and the site metadata
  description in [apps/web/src/app/layout.tsx:12](apps/web/src/app/layout.tsx#L12) did too.
- **The problem (copy):** the constitution's product invariants promise "no lock-in … any AI
  assistant (Claude Code is the primary target)". Front-page copy that names one tool contradicts
  that promise and narrows the audience.
- **The problem (scroll):** "See how it works" is a plain `<Link href="#how">` and nothing set
  `scroll-behavior`, so the browser jumped instantly to the `#how` section — it read as a page swap,
  not a transition.
- **The problem (em dashes):** almost every copy string on the page was built around an em dash: the
  hero paragraph, the step bodies, the deliverable bodies, the "Why spec-driven" lines, the Examples
  and Pricing paragraphs. It is the single most recognisable tell of AI-written marketing text, and
  it undercut the page exactly where the page argues that Airrow produces senior work.
- **The problem (examples):** the Examples section was a dashed placeholder card reading "Sample
  foundations — coming soon". The page asked a founder to trust the output without ever showing any
  of it, even though the canonical scaffold sits in the repo: `template/CLAUDE.md`,
  `template/.claude/commands/*.md`, `template/docs/architecture/SYSTEM_OVERVIEW.md`,
  `template/specs/README.md` and `template/START_HERE.md`.
- **The problem (footer):** the footer was a logo plus one mono line, and there were no legal pages
  at all — `apps/web/src/app` had no `privacy`, `terms` or `cookies` route.
- **Already in place:** `scroll-mt-20` on the `#how` section so an anchor lands below the sticky
  header; a `prefers-reduced-motion` block in
  [apps/web/src/app/globals.css](apps/web/src/app/globals.css#L188-L197) that forces
  `scroll-behavior: auto`, so honouring reduced motion came for free;
  [`loadTemplate()`](apps/web/src/lib/template/load.ts) already reads `template/**` from disk for the
  generation engine, and `next.config.ts` already keeps that directory in the deployed file trace.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

Rewrite the tool-specific landing copy to be assistant-neutral ("AI agents"/"your agents") while
keeping Claude Code as the named example where it is genuinely concrete: in the post-generation
"continue" instructions, not on the marketing page. Rewrite the same strings without em dashes, using
ordinary sentence punctuation rather than swapping one dash character for another. Give the brand
name in the hero paragraph a token-based emphasis (a span, not a colour literal) so it reads as the
subject of the sentence. Fold the Examples placeholder into the "Why spec-driven development"
section and make that section carry the proof: the loop an issue travels through
(`/createspec → /clarify → /implement → /analyze`, with each command's real description) and five
files that explain why the method holds, each with the reason it earns its place. Both are read from
`template/` on the server through the existing `loadTemplate()`, so the section can never drift from
what generation produces. It is deliberately partial: a file count hints at the rest rather than
listing it. Get smooth scrolling from CSS (`scroll-behavior: smooth` on the document)
rather than a JS scroll handler, so the anchor link stays a plain link and reduced-motion users keep
the instant jump. Build the footer as a real site footer with link columns, shared with the new legal
pages.

Every visible landing string moved into one module,
[`features/landing/copy.ts`](apps/web/src/features/landing/copy.ts), so the voice is reviewed (and
tested) in one place rather than hunted for across JSX. Icons stay keyed by name, as
[`nav-items.ts`](apps/web/src/components/shell/nav-items.ts) already does.

**Decisions taken during `/implement`** (the spec's open questions, resolved rather than deferred):

- **Copy scope:** landing page plus the site metadata in `layout.tsx` (it is the homepage's search
  result). The `/app` screens and the "continue locally" walkthrough keep their wording.
- **Hero emphasis:** the quiet option — full-contrast `text-fg` plus `font-medium` against the muted
  line. No accent colour.
- **Examples form:** not a file dump. The full tree was tried first and read as inventory, so it was
  replaced by the four-step loop plus five annotated files, ending in "+ N more files waiting in your
  repository". Read from disk, not curated constants, so a renamed template file fails the test suite
  instead of silently emptying the section.
- **Deliverables:** "Roadmap" is replaced by "CI/CD pipeline" (GitHub Actions that lint, typecheck,
  test and deploy from the first commit) — that is what the scaffold actually ships in
  `template/.github/workflows/`, and it is the line a developer cares about.
- **Strapline:** the shape stays, only the tool name goes:
  `Idea → Airrow → Code → Company`. (A `spec → context → pipeline → first commit` variant was tried
  and rejected — the original arrow reads better.)
- **Footer:** one thin horizontal row — logo, six short links (How it works, Spec-driven, Pricing,
  Privacy, Terms, Cookies), copyright — rather than a column grid. A marketing footer should close
  the page, not restate it. No Contact/Status/GitHub links, because none of those pages exist yet.
- **Shell alignment:** the landing header is 68px tall (`py-3.5` around an `h-10` lockup). The app
  sidebar header, the app top bar and the legal header now all match it (`h-17`, logo at `h-10`), so
  moving between the public site and the app doesn't jump the horizon line. With the header taller,
  the rest of the shell is re-proportioned around it: the expanded rail narrows to `w-52` while its
  nav items grow (`text-base`, `size-4.5` icons, more breathing room), the top bar's breadcrumbs,
  theme icon, avatar and "New project" button step up one size, and the collapse button centres its
  icon when there is no label beside it. The theme switch is shared, so the marketing and legal
  headers get the same slightly larger icon.
- **Legal text:** written for what Airrow actually does (Vercel, Supabase, Anthropic, RLS,
  cascade-on-delete, the two cookies it sets), with a visible early-access notice on every page
  saying the operating entity, registered address and governing law are published before general
  availability. Contact is `hello@airrow.app`, matching the real domain.
- **Cookie banner:** no. Airrow sets only strictly necessary cookies (`airrow-theme`, Supabase
  `sb-*`), which need no consent; the Cookie policy says so explicitly and lists them.

**Not touched:** the app's navigation structure and `/app` copy, and the
`/app/projects/[id]/continue` walkthrough — that screen intentionally instructs the founder to
install a specific tool. The shell change is height and logo size only; nothing moves or disappears.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] No occurrence of "Claude Code" remains in the landing page copy — hero paragraph, step-03 card
      and the `Idea → … → Company` strapline all read in assistant-neutral terms.
- [x] The replacement copy still says something concrete (not just a find-and-replace of the tool
      name), and keeps the page's existing voice and length balance.
- [x] In the hero paragraph the word "Airrow" stands out from the surrounding sentence rather than
      sitting flat in the muted body colour, and it does so with design-system tokens (`text-fg` +
      `font-medium` against the `text-fg-muted` line), never a hardcoded colour.
- [x] The emphasis reads as emphasis, not as a link: it is not underlined, not clickable, and keeps
      the paragraph's line height and rhythm intact in both themes.
- [x] No em dash (`—`) and no double hyphen (`--`) appears in any visible copy string on the landing
      page. Sentences are restructured with normal punctuation, not patched with a different dash or
      a semicolon in the same slot.
- [x] The "coming soon" placeholder card is gone. The Examples content is merged into the
      spec-driven section and shows how the method works: the four-step command loop with each
      command's real description, and five files with the reason each one matters.
- [x] The section stays a teaser, not an inventory: no full project tree, and a
      "+ N more files waiting in your repository" line points at the rest.
- [x] "Roadmap" in the deliverables grid is replaced by a CI/CD pipeline entry describing the
      GitHub Actions the scaffold ships.
- [x] The hero strapline keeps its original shape with the tool name generalised:
      `Idea → Airrow → Code → Company`.
- [x] The footer is a single thin horizontal row (logo, links, copyright), not a column grid, with
      the logo at the `md` lockup size so it still reads as a signature.
- [x] Expanded, the app rail is narrower than before and its "Projects" and "Settings" items sit
      larger and more evenly spaced, sitting below the header rather than tight against it.
      Collapsed, the expand/collapse button's icon is centred in the rail.
- [x] The top bar's bottom border runs unbroken across the rail as well, so one line crosses the
      whole viewport, and the current breadcrumb reads as a page title.
- [x] Every dashboard screen sits in the landing page's column (`max-w-6xl px-6`) through one shared
      `PageContainer`, page titles share one size, and no screen carries its own wider `md:px-8`
      inset. Focused screens (new project, interview, generation, continue) keep their deliberately
      narrow centred measure but the same horizontal padding.
- [x] Collapsing or expanding the rail leaves page content exactly where it was: content is centred
      on the viewport, not on the space left over beside the rail. Only the top bar and the
      preview's file tree follow the rail.
- [x] Nothing jumps and settles during the animation: `--rail` is a registered custom property that
      animates as a single value, so every offset derived from it moves in lockstep instead of some
      properties transitioning while others snap.
- [x] In the preview, the file text holds its position while the tree moves, and never slides under
      the tree when the viewport is too narrow to centre it.
- [x] The route-level loading splash is centred on the viewport too, so a navigation that starts
      mid-animation doesn't drift.
- [x] The app sidebar logo (expanded lockup and collapsed mark), the app top bar and the legal-page
      header all render at the landing header's size, so the header height and logo size stay put
      when moving between the marketing site, the legal pages and the dashboard.
- [x] The example content is legible on mobile: file paths scroll inside their own container and
      the page body never scrolls sideways.
- [x] The example content is read from `template/` on the server at render time via the existing
      `loadTemplate()`, so it stays true as the scaffold evolves.
- [x] Pressing "See how it works" scrolls smoothly down to the "How it works" section instead of
      jumping, landing with the section heading clear of the sticky header.
- [x] Users with `prefers-reduced-motion: reduce` still get an instant jump (no animated scroll).
- [x] The footer contains real, working links to the site's legal pages (Privacy policy, Terms of
      service, Cookie policy) alongside product anchors, the logo and the byline.
- [x] Every footer link resolves to a real page — no `#` placeholders and no 404s.
- [x] Each legal page is reachable directly by URL (200 in `pnpm dev`, listed by `pnpm build`) and
      renders through the existing `.prose-airrow` tokens, so it themes with the rest of the site.
      Its header and page column share the landing page's width, so the logo does not shift when
      following a footer link. Visual pass in both themes still outstanding.
- [x] No cookie-consent banner: only strictly necessary cookies are set, and the Cookie policy lists
      them and says why no banner appears.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests**
  - [`apps/web/src/features/landing/copy.test.ts`](apps/web/src/features/landing/copy.test.ts) —
    walks every exported landing string (and the footer labels) and fails on "Claude Code", `—` or
    `--`.
  - [`apps/web/src/features/landing/foundation.test.ts`](apps/web/src/features/landing/foundation.test.ts)
    — the scaffold reader resolves the loop in order with non-empty descriptions, every highlighted
    path exists in the template, and the quoted descriptions obey the same dash rule as the copy.
  - [`apps/web/src/components/shell/footer-links.test.ts`](apps/web/src/components/shell/footer-links.test.ts)
    — every footer href resolves to a `page.tsx` (route groups included) or to an `id` the landing
    page renders; no `#` placeholders.
- Smooth scroll and the reduced-motion fallback → the production CSS bundle contains
  `html{scroll-behavior:smooth}` and, inside the `prefers-reduced-motion` block,
  `scroll-behavior:auto!important`. **Still to eyeball in a browser:** the animation itself and both
  themes on the legal pages.
- No dash tell on the rendered page → the served homepage HTML contains zero `—` characters and no
  `--` in text nodes (checked against the running dev server).
- Legal pages reachable → `pnpm dev` returns 200 for `/privacy`, `/terms` and `/cookies`;
  `pnpm build` lists all three routes.
- Shell alignment → `h-17` resolves to 4.25rem (68px) in the built CSS, the same height the landing
  header gets from `py-3.5` around an `h-10` logo; the legal header serves the lockup at `h-10`.
  **Still to eyeball:** the dashboard at both sidebar states.
- **Results (2026-07-25):** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test`
  54 passed, 15 skipped (the four Supabase RLS/cutover suites, which need a local Supabase and were
  already skipped before this change) · `pnpm build` succeeds.

---

## Exact changes (file:line)

_The plan, for whoever implements it. Every change grounded in current code; expanded by `/implement`._

1. **[apps/web/src/features/landing/copy.ts](apps/web/src/features/landing/copy.ts)** (new) — every
   visible landing string, em-dash free and assistant-neutral, with the hero lead split so the brand
   name can carry emphasis. Deliverable icons are keys, resolved by the page.
2. **[apps/web/src/features/landing/foundation.ts](apps/web/src/features/landing/foundation.ts)**
   (new) — `readFoundation()` resolves the four loop commands (name + frontmatter description),
   verifies every highlighted path exists, and counts the scaffold, all from `loadTemplate()`.
   Throws when the scaffold no longer holds what the section promises.
3. **[apps/web/src/features/landing/SpecDrivenShowcase.tsx](apps/web/src/features/landing/SpecDrivenShowcase.tsx)**
   (new) — presentational server component; the page does the I/O and passes the data in. Everything
   renders as escaped text inside `Card`s, with paths in `overflow-x-auto` containers.
4. **[apps/web/src/components/shell/footer-links.ts](apps/web/src/components/shell/footer-links.ts)**
   (new) — the footer's six links as plain data, so the link set is testable.
5. **[apps/web/src/components/shell/site-footer.tsx](apps/web/src/components/shell/site-footer.tsx)**
   (new) — the public footer, shared by the landing page and the legal layout: one row, `py-5`.
6. **[apps/web/src/features/legal/meta.ts](apps/web/src/features/legal/meta.ts)** (new) — contact
   address, last-updated date and the early-access notice, in one place.
7. **[apps/web/src/app/(legal)/layout.tsx](<apps/web/src/app/(legal)/layout.tsx>)** (new) — header
   with logo, theme switch and "Back to site"; the early-access notice; the shared footer. Header and
   page column are `max-w-6xl px-6`, the landing page's, and the text spans that column too, so the
   logo and both text edges sit in exactly the same place across the two.
8. **`apps/web/src/app/(legal)/{privacy,terms,cookies}/page.tsx`** (new) — the three documents,
   written against how Airrow actually works.
9. **[apps/web/src/app/page.tsx](apps/web/src/app/page.tsx)** — renders from `copy.ts`; emphasises
   "Airrow" in the hero lead; merges the Examples section into `#spec-driven` and adds `#pricing`,
   both with `scroll-mt-20`; renders `<SpecDrivenShowcase />`; swaps the inline footer for
   `<SiteFooter />`; maps the new `pipeline` deliverable icon.
10. **[apps/web/src/app/globals.css](apps/web/src/app/globals.css#L165-L169)** — `html {
    scroll-behavior: smooth }`; the existing reduced-motion block overrides it.
11. **[apps/web/src/app/layout.tsx](apps/web/src/app/layout.tsx#L9-L16)** — metadata description
    de-branded and em-dash free; the title separator becomes `·`, matching the title template.
12. **[apps/web/src/components/shell/top-bar.tsx](apps/web/src/components/shell/top-bar.tsx)** and
    **[apps/web/src/components/shell/sidebar.tsx](apps/web/src/components/shell/sidebar.tsx)** —
    `h-14` → `h-17` on both headers, the rail's lockup to `size="lg"` and its collapsed mark to
    `h-10`, the mobile menu button re-centred to `top-5`, the expanded rail `w-60` → `w-52` (spacer
    included), nav items to `text-base` / `size-4.5` / `py-2.5` / `space-y-1`, the collapse button
    centred when collapsed, and "New project" to `size="md"`.
    The rail's header also takes a `border-b` so the top bar's line continues across it, and the nav
    gets `pt-4`.
    **[breadcrumbs.tsx](apps/web/src/components/ui/breadcrumbs.tsx)** (`text-lg`, current crumb
    `font-medium`, `size-4` chevron), **[theme-switch.tsx](apps/web/src/components/shell/theme-switch.tsx)** (`size-4.5`
    icon, `p-2`) and **[user-menu.tsx](apps/web/src/components/shell/user-menu.tsx)** (`size-8`
    avatar) follow.
14. **[apps/web/src/components/shell/page-container.tsx](apps/web/src/components/shell/page-container.tsx)**
    (new) — the shared page column: an outer element that steps back out of the shell's `--rail`
    offset (`-ml-(--rail)` + `w-[calc(100%+var(--rail))]`) around an inner
    `mx-auto w-full max-w-6xl px-6 py-10`, so content centres on the viewport and holds still while
    the rail animates. Adopted by the dashboard, projects list, project overview, settings, new
    project, the interview (both screens), generation and continue — each passing its own measure
    through `className`. `md:px-8` is gone everywhere in `/app`.
15. **[apps/web/src/app/globals.css](apps/web/src/app/globals.css)** — `@property --rail` (registered
    so the variable itself animates, with `.app-shell` transitioning it), `.viewport-column` (the
    reusable "don't move with the rail" correction, used by `PageContainer` and `BrandSplash`) and
    `.preview-reader` (content-box column whose left inset centres the file text on the viewport,
    clamped so it never slides under the tree).
16. **[apps/web/src/features/preview/PreviewBrowser.tsx](apps/web/src/features/preview/PreviewBrowser.tsx)**
    and **[apps/web/src/components/brand/splash.tsx](apps/web/src/components/brand/splash.tsx)** —
    adopt `.preview-reader` and `.viewport-column` respectively.
17. **[apps/web/src/components/shell/rail.tsx](apps/web/src/components/shell/rail.tsx)** (new) —
    `RailProvider` owns the collapsed state (previously local to `Sidebar`) and publishes the rail's
    width as `--rail-width`; [globals.css](apps/web/src/app/globals.css) turns that into `--rail`,
    which is `0px` outside the shell and below `md` where the rail is a drawer. `Sidebar` reads the
    state through `useRail()` and no longer renders a layout spacer; the app layout's column carries
    `pl-(--rail)`, so the top bar and the preview browser follow the rail while `PageContainer`
    opts out.
13. **`.claude/commands/pr-check.md` + `template/.claude/commands/pr-check.md`** — the one
    frontmatter description containing an em dash, which the Examples section quotes verbatim onto
    the homepage. Both copies changed together so the repo and the scaffold stay identical.

**No change needed:** the `#how` anchor and its `scroll-mt-20` already place the target correctly;
`loadTemplate()` and the `outputFileTracingIncludes` entry in `next.config.ts` already make the
scaffold readable in production.

---

## Data model

**No schema changes.** Static marketing and legal content only.

---

## Security

Nothing security-relevant: the change is marketing copy, a CSS scroll property, and new public pages
with no inputs, no data access and no new external calls. Two constraints hold: the example content
comes only from committed `template/` files (no user or generated content, no path taken from a
request) and is rendered as escaped text, never `dangerouslySetInnerHTML`; and the legal pages name
no internal infrastructure or non-public contact address. No cookie-consent banner is introduced, so
no new cookie is set.

---

## Edge cases

- **JS disabled** — the anchor link and smooth scroll are pure HTML/CSS, so both keep working.
- **`prefers-reduced-motion: reduce`** — instant jump, no animated scroll (enforced globally).
- **Deep link to `#how`** — arriving with the hash in the URL lands directly on the section; the
  browser does not animate an initial-load jump, which is correct.
- **Narrow viewport** — the footer columns stack instead of overflowing, and the file tree scrolls
  inside its own container.
- **A `template/` file is renamed or removed** — `readFoundation()` throws by path, so
  `foundation.test.ts` and the build fail rather than the section rendering empty.
- **A loop command loses its frontmatter description** — same: it throws by command name.
- **The scaffold grows or shrinks** — the "+ N more files" line counts what is actually there, so it
  cannot go stale or go negative while the highlights are part of the same tree.
- **Legal page opened directly / from a search engine** — the `(legal)` layout gives it its own
  header, a "Back to site" action and the shared footer.

---

## Out of scope

- Cookie-consent management and analytics gating: nothing to consent to while only strictly necessary
  cookies exist.
- A blog, changelog, status page or docs site — footer links only point at pages that exist.
- A browsable sample-repo gallery or downloadable demo foundation. The spec-driven section shows the
  method and a few files, not a full generated project.
- Em-dash cleanup outside the landing page. **Deviation:** one exception was necessary — the
  `pr-check` command description is quoted verbatim onto the homepage, so its em dash was removed in
  both `.claude/commands/` and `template/.claude/commands/`. No other template or `/app` copy
  changed.
- De-branding the post-generation "continue" walkthrough or the generated `template/` output.
- Any redesign of the landing page beyond the spec-driven section, the one deliverable swap, the
  strapline and the footer; layout, section order and everything else stay as they are.
