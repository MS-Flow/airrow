---
description: Review the whole repository for vulnerabilities, fix what changes nothing visible, and write SECURITY_AUDIT.md.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Find everything in airrow that a competent attacker could use, fix what can be fixed without changing
anything a user would notice, and write down the rest.

Read @.claude/spec-kit/constitution.md first; everything below is subject to it.
[`docs/guides/SECURITY.md`](../../docs/guides/SECURITY.md) says what CI already gates — this command
is the part CI cannot do.

**This command takes no arguments, and it always covers the whole repository.** A review that quietly
skipped half the code would still read like a review of all of it, and that is worse than no review —
it is a false all-clear. If an argument was passed, ignore it and say so.

**Three limits, before anything else:**

1. **It changes nothing a user can see.** A fix that alters how a page looks, what it says, where a
   route goes, or what a working flow does is *proposed*, never applied — no matter how good the
   security reason. Section 5 draws the line exactly.
2. **It installs nothing and downloads nothing.** `pnpm audit` and the other tooling already in this
   repository may be run. Nothing new gets added to do it.
3. **It sends nothing anywhere.** No file, no finding, no key, no snippet leaves this machine. No
   request against dev, staging or production — this command reads code, it does not attack anything.

**Re-runnable by design.** A second run re-checks everything the last one claimed before it looks for
anything new, and never overwrites a note a human added to the report.

---

## 1. Start from the last report

No `SECURITY_AUDIT.md` in the repository root? Then this is the first run — go to section 2.

If there is one, **re-check every line of it before looking for anything new.** A report describes a
codebase that has changed since it was written, so treat all of it as claims to verify, not as facts
to carry forward — and verify them against the code, never against the report's own word. The fixes
deserve the most scrutiny: a guard everyone believes in is the one nobody checks. Here that means
re-running the denial tests behind a revoked privilege, re-reading the migration that revoked it, and
re-running `pnpm audit` rather than trusting a line saying it was clean in May.

Take every entry it lists, closed and open alike, and decide which of these it now is:

- **Still fixed.** The guard is there and still does what it says. Name what you re-checked — the
  test, the revoked grant, the header in `routes-manifest.json` — not just that you checked. Where the
  earlier run proved something by running it, run it again.
- **Regressed.** The guard is gone, weakened or routed around — a migration that re-granted, a test
  deleted with the feature it covered, a dependency pinned back. That is a **new finding, at the old
  severity or higher**, naming the run that first closed it. A hole that comes back is worse than one
  never closed, because there is a report saying it is gone.
- **Still open.** Carry it forward with its evidence, and check that the `file:line` still points at
  what it pointed at. Code moves; a finding aimed at the wrong line stops being read.
- **Resolved another way.** The code changed and the path no longer exists. Prove that, then mark it
  resolved with today's date and time.
- **Vanished.** The file or the feature is gone. Say so plainly — that is a disappearance, not a fix,
  and it comes back when the feature does.

Anything a person wrote in that file — a note, a decision, an accepted risk — is theirs. Carry it
across word for word.

Only once the old report is settled does the new run start.

## 2. Map the surface

Start from the architecture in [`CLAUDE.md`](../../CLAUDE.md) and
[`docs/architecture/SYSTEM_OVERVIEW.md`](../../docs/architecture/SYSTEM_OVERVIEW.md) and check it
against the code, because the map is only useful if it is current:

- **The layers**: `app/**` → client components → server actions / route handlers → feature
  `queries.ts` / `actions.ts` → `apps/web/src/lib/data/store.ts` → Supabase. Anything reaching around
  a layer is both an architecture bug and, usually, a missing authorization check.
- **The entry points**: every route under `apps/web/src/app/**`, every `"use server"` action, every
  handler under `app/api/**` (`api/chat`, `api/projects/[id]`, `api/stripe/webhook`), the middleware,
  and the invite and auth callback routes. For each: reachable without a session, or not?
- **The public surface specifically**: the landing chat and its rate limiting, signup, login, password
  reset, the invite acceptance path, and anything under `(legal)`. These take input from people who
  have no account and no reason to be polite.
- **The tenancy**: every table hangs off `organization_id`, every table has RLS, and server code
  scopes queries as well. `chat_rate_limits` is the single documented exception — no tenant, nobody
  granted anything, denial-tested like the rest.
- **The money and the entitlements**: `checkAllowance`, `claimAllowance`, `applySubscriptionState`,
  `plan_grants`, and the two paths allowed to write `organizations.plan` (the Stripe webhook and
  `features/billing/sync.ts`). A path that grants a plan from anything other than something Stripe
  told us is a critical finding by definition.
- **The keys**: two separate Claude keys (generation's authoring provider and the landing chat's
  provider — never shared), Supabase service-role vs. anon, the GitHub App's private key and
  installation tokens, the Stripe secret and webhook signing secret.
- **The pipeline**: `.github/workflows/ci.yml` and the deploy workflows — what they run, what secrets
  they hold, what they print.

## 3. Look — go through every category

Work the list. Do not stop at the first finding, and do not skip a category because "we would have
noticed" — say what you checked and what you found, per category.

**Secrets and credentials.** Keys, tokens, connection strings, the GitHub App private key, Stripe
secrets and signing secrets in source, tests, fixtures, comments, logs, error messages, or anything
the client bundle contains. A server-only value behind `NEXT_PUBLIC_`. Service-role Supabase clients
used where the request-scoped client would do. **Search the commit history too** — a key deleted from
the code is still live until it is rotated, and the report says *rotate*, never *delete that line*.
The history is not ours to rewrite here.

**Authentication and authorization.** A route, action or handler that never resolves the session. A
check done in a client component and not repeated on the server. An `organizationId` or `projectId`
taken from the request and trusted instead of derived from the session. A resource fetched by id
without asking whether this member may have it. Admin surfaces (`/app/admin`) reachable without the
gate. RLS missing on a new table, or written so it lets everything through — and the denial test that
should have caught it missing too. Invite and referral links that grant more than intended, or that
can be replayed.

**Injection.** Queries built by string concatenation instead of the client's parameterized calls.
Shell commands assembled from input. Paths built from user-controlled strings — file names inside an
imported ZIP, generated repo paths, anything under `.data/`. Requests whose destination URL comes from
input (server-side request forgery), including anything that fetches a repository or an avatar.
`eval`, `new Function`, dynamic `import()` of a computed path. And **prompt injection**: interview
answers, imported source files, chat messages and generated documents all reach a model or come back
from one. Anything a model wrote is untrusted text — it is validated against a document contract
before acceptance, never executed, never trusted as instructions.

**Output and rendering.** Generated and authored markdown is untrusted: sanitized rendering only,
never `dangerouslySetInnerHTML` with user-derived content, never executed. Check the preview tree, the
support and review surfaces, the admin console, and every email body. User-controlled redirects after
login or checkout. Filenames from an import echoed into a page.

**Requests and sessions.** State-changing operations reachable by `GET`. Cross-site request forgery
protection on anything that mutates. Cookie flags on the Supabase session cookies. CORS on the API
routes. Missing security headers. The webhook route accepting a body it has not verified.

**Validation.** Zod at every boundary — forms, actions, route handlers, engine I/O, and all model
output. Anything that parses a request body by hand or trusts its shape. Object updates that write
every field the caller sent. The import path: ZIP size, entry count, path traversal in entry names,
file type, and what happens with a hostile archive. Queries with no pagination that a caller can ask
to return everything.

**Abuse and cost.** The landing chat is a public, unauthenticated call to a paid model — its ceilings
and rate limits are load-bearing, and a way around them is a high finding. Signup, login, password
reset, invite acceptance and generation each cost something: check what stops a loop. Enumeration —
an endpoint that answers differently for "this account exists" and "it does not".

**Cryptography and verification.** The Stripe webhook signature, the GitHub App's JWT and installation
tokens, any token compared with `===` where it should be timing-safe, any use of `Math.random()` where
the value must be unguessable, and how short-lived every signed URL actually is.

**Leakage.** Stack traces or Postgres errors returned to the caller. Logs carry IDs and metadata only
— never interview answers, generated document bodies, chat messages, tokens or personal data. Debug
routes or verbose logging alive in production. Anything under `.data/` served, listed or committed.

**Dependencies and pipeline.** Run `pnpm audit --prod --json > audit.json` if no current `audit.json`
is already there, and read it against `.security/audit-baseline.json` — the baseline is the accepted
set, so report what is new rather than re-deriving a severity rule CI already owns
([`docs/guides/SECURITY.md`](../../docs/guides/SECURITY.md), spec 33). Then: install-time scripts in
dependencies, unpinned or mutable-tag actions in the workflows, secrets a step could print, and any
build step that fetches something from the internet and runs it.

## 4. Judge what you found

For every finding, write four things. Anything you cannot write all four for is a **suspicion**, and
it goes in the report labelled as one — never as a vulnerability.

1. **Severity** — `Critical` (someone reads or changes another organization's data, or takes over the
   system, from the internet, today), `High` (the same, needing an account or an unlikely
   precondition), `Medium` (real exposure with limits), `Low` (hardening; nothing exploitable found).
   Rate what an attacker can *do*, not how ugly the code is.
2. **The path** — how it is actually exploited, in one or two concrete sentences. "A member of org A
   changes the id in `/api/projects/<id>` and reads org B's project" is a path. "Improper access
   control" is a category.
3. **The evidence** — `file:line`. Every finding points at code you have read.
4. **Confidence** — certain, or what would have to be true for it to be real.

Rank by severity, then by how easy it is to reach. That ranking is the order you fix in and the order
the report lists.

## 5. Fix — and the line you do not cross

**Fix now — invisible to anyone using the product:**

- Parameterize a query; sanitize output that is rendered.
- Add the server-side authorization or org-scoping check that should have been there, where the
  caller was already supposed to be denied.
- Tighten a Zod schema at a boundary that already rejects malformed input.
- Stop logging a secret, a token, an answer body or personal data.
- Verify a signature; make a token comparison timing-safe; use a secure random source.
- Move a hard-coded secret into the environment — and say in the report that the key must be rotated.
- Narrow a permission, a signed URL's expiry, or a workflow's token scope that is broader than what
  the code uses.
- Add an RLS policy and its denial test where a table is missing one. Access control ships with the
  resource; adding it is restoring an invariant, not a product change. If the table has live rows and
  the policy could hide them from a working screen, it belongs in the next list instead.

**Ask first — anything a person could notice:**

- Anything that changes a page's appearance, its wording, a route, a URL or a flow.
- A new authentication or authorization requirement that shuts out someone who gets in today.
- A content security policy, or headers that can break embedding or third-party widgets.
- Rate limits, lockouts and captchas — they change what a legitimate user experiences.
- Dependency upgrades across a major version.
- Migrations, schema changes, workflow permissions, deployment configuration.

Put these to the user **one at a time**, each with: the risk, exactly what you would change, and what
they would notice afterwards. Do only the ones they say yes to. A question that gets a no — or no
answer at all — becomes a proposal in the report and nothing more. Silence is not consent.

**Never:**

- Delete code, data, files or history to make a finding go away.
- Turn off a working feature "to be safe".
- Touch remotes, credentials, Supabase, Stripe, the GitHub App, or anything outside this repository.
- Add a dependency, install a tool, or send anything anywhere.
- Rewrite git history, even to remove a leaked key. Report it; rotation is the fix.
- Change a spec's recorded decisions, or the constitution, to make a finding acceptable.

## 6. Verify before you call anything fixed

```bash
pnpm -r typecheck
pnpm -r lint
pnpm -r test
pnpm test:scripts
pnpm build
```

All of them as green as they were when you started — note anything already failing before you touched
it, so a pre-existing failure is not mistaken for your doing. A change to the data layer means the RLS
tests matter most; run them and say so.

**If a fix breaks any of them, revert that fix.** Put it back exactly as it was and move the finding
into the report as something that needs a real change — a spec, not a patch. A repository left broken
by a security fix is the one outcome that guarantees the fix gets turned off.

## 7. Write `SECURITY_AUDIT.md`

In the repository root, **rewritten from scratch every run** — it describes airrow as it is today, not
a stack of appended runs. What survives a rewrite is named below.

Sections, in this order:

0. **Run log** — one row per run, and no row is ever removed:

   | Run | Date and time | Commit | Found | Fixed | Left open |
   | --- | --- | --- | --- | --- | --- |
   | 1 | 2026-08-01 12:56 (+02:00) | `f5162a9` | 4 | 4 | 0 |

   Take the date **and the clock time, with the offset**, from the machine (`date`) rather than
   guessing at it. Two runs in one day is exactly what happens on the day somebody decides to fix
   things, and without the time nobody can tell which came first.

1. **Header** — the date and time of *this* run, the current commit, what was reviewed, and anything
   that was not (a check that needed the network, a directory too large to read).
2. **Summary** — counts per severity, how many fixed, how many waiting on a decision, and what changed
   since the last run: new, regressed, closed.
3. **Fixed** — per fix: what it was, severity, exploitation path, `file:line`, what changed, the date
   and time it was fixed, and that the verification bar is green. Entries from earlier runs stay here,
   with the run that closed them.
4. **Found, not fixed** — per finding: severity, path, evidence, the proposed fix, and **why it was
   not done** (waiting for approval / needs a product decision / requires infrastructure / outside
   this repository). Then the suspicions, plainly labelled.
5. **Needs you, outside the code** — rotate this key, change that setting in the Supabase or Stripe
   dashboard, fix that repository setting, set that secret in Actions.
6. **Checked and clean** — every category from section 3 reviewed and found nothing in. This is what
   makes the next run cheaper and what tells a reader how much "secure" currently covers.
7. **Next** — the prioritized list, worst first.

**The report never leaves this machine.** `SECURITY_AUDIT.md` is in `.gitignore` and stays there —
this file is a list of the ways into airrow that are still open, and committed to a public repository
it is a map handed to whoever finds it. Never commit it, and never paste it anywhere.

**What a rewrite must never lose.** The body is rewritten; the history is not. Carry across, every
time:

- **The run log**, with a new row appended for this run.
- **Every finding ever raised** — a fixed one is marked resolved with the date and time it was fixed
  and the run that did it, never deleted. The exploitation path is what tells the next reader why the
  guard exists, and a guard nobody understands is a guard somebody removes.
- **Everything a human wrote**, word for word.

A finding still open is updated in place rather than listed twice, and one that came back is a new
entry that says which run had closed it.

## 8. Report back

Briefly, in the conversation: how many findings by severity; what changed since the last run (new,
regressed, closed) and what you re-verified from it; what you fixed and that the bar is green; what is
waiting on a decision; and the single most important thing to do next. Point at `SECURITY_AUDIT.md`
for the detail.

Say what you did not check as clearly as what you did. **Never report that the project is secure** —
report what was reviewed, what was found, and what remains. Anything you want changed but may not
change yourself goes through `/createspec`, like every other change here.
