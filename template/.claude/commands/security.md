---
description: Review the whole repository for vulnerabilities, fix what changes nothing visible, and write SECURITY_AUDIT.md.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

Find everything in **{{PROJECT_NAME}}** that a competent attacker could use, fix what can be fixed
without changing anything a user would notice, and write down the rest.

Read @.claude/spec-kit/constitution.md first; everything below is subject to it.

**This command takes no arguments, and it always covers the whole repository.** A review that quietly
skipped half the code would still read like a review of all of it, and that is worse than no review —
it is a false all-clear. If an argument was passed, ignore it and say so.

**Three limits, before anything else:**

1. **It changes nothing a user can see.** A fix that alters how a page looks, what it says, where a
   route goes, or what a working flow does is *proposed*, never applied — no matter how good the
   security reason. Section 5 draws the line exactly.
2. **It installs nothing and downloads nothing.** Tools the project already has may be run. A scanner
   that is not here does not get fetched, and a missing tool is a gap in the report, not an excuse to
   add a dependency.
3. **It sends nothing anywhere.** No file, no finding, no key, no snippet leaves this machine. No
   request is made against a running site, staging or production — this command reads code, it does
   not attack anything.

**Re-runnable by design.** A second run re-checks everything the last one claimed before it looks for
anything new, and never overwrites a note a human added to the report.

---

## 1. Start from the last report

No `SECURITY_AUDIT.md` in the repository root? Then this is the first run — go to section 2.

If there is one, **re-check every line of it before looking for anything new.** A report describes a
codebase that has changed since it was written, so treat all of it as claims to verify, not as facts
to carry forward — and verify them against the code, never against the report's own word. The fixes
deserve the most scrutiny: a guard everyone believes in is the one nobody checks.

Take every entry it lists, closed and open alike, and decide which of these it now is:

- **Still fixed.** The guard is there and still does what it says. Name what you re-checked — the
  test, the revoked privilege, the header the build emits — not just that you checked. Where the
  earlier run proved something by running it, run it again.
- **Regressed.** The guard is gone, weakened or routed around. That is a **new finding, at the old
  severity or higher**, and it names the run that first closed it. A hole that comes back is worse
  than one never closed, because there is a report saying it is gone.
- **Still open.** Carry it forward with its evidence, and check that the `file:line` still points at
  what it pointed at. Code moves; a finding aimed at the wrong line stops being read.
- **Resolved another way.** The code changed and the path no longer exists. Prove that, then mark it
  resolved with today's date and time.
- **Vanished.** The file or the feature is gone. Say so plainly — that is a disappearance, not a fix,
  and it comes back when the feature does.

Anything a person wrote in that file — a note, a decision, an accepted risk, a "we know, it is on the
roadmap" — is theirs. Carry it across word for word.

Only once the old report is settled does the new run start.

## 2. Map the project

You cannot find what you cannot see. Before looking for a single bug, work out where the boundaries
are — the places where something outside this codebase reaches inside it.

- **The stack**: manifests, lockfile, framework, package manager, test runner. What runs on a server,
  what is shipped to a browser, and exactly which files cross that line.
- **The entry points**: every route, endpoint, handler, action, webhook, cron, queue consumer, CLI
  and form. For each: can it be reached without logging in?
- **The data**: where it is stored, what is sensitive, who is supposed to be able to read it, and
  what enforces that — the database's own rules, the server's code, or nothing.
- **The trust boundaries**: user input, uploaded files, URL parameters, headers, cookies, third-party
  webhooks, environment variables, and any text written by a language model. Everything crossing one
  of those is untrusted until something validates it.
- **The secrets**: where they are kept, which ones the client bundle can see, and how they reach
  the deployed environment.
- **The pipeline**: `{{CI_FILE}}`, what it runs, what it has access to, and what it prints.

Write the map down in your report before you go looking. The map is what tells you which of the
findings below actually matter here.

## 3. Look — go through every category

Work the list. Do not stop at the first finding, and do not skip a category because the project
"probably doesn't have that" — say what you checked and what you found, per category. If a category
does not apply, that is a sentence in the report, not silence.

**Secrets and credentials.** API keys, tokens, passwords, connection strings, private keys and
signing secrets in source, config, tests, fixtures, comments, logs, error messages, or anything the
client downloads. Server-only values exposed through a public/client-side prefix. Credentials with
production scope used in development. **Also search the commit history for secrets** — a key that was
deleted from the code is still in the history and still works, so it is still a live key. Anything
found there is reported as *rotate this*, not *delete that line*; the history is not yours to rewrite.

**Authentication and authorization.** Endpoints that never check who is calling. Checks done in the
browser but not on the server. A user id, organization id, tenant id or role read from the request
body, a query parameter or a cookie and then trusted. Objects fetched by id without asking whether
this caller may have them (insecure direct object reference). Admin functionality reachable by
guessing a URL. Database-level access rules missing, disabled, or written so they let everything
through. Sessions that never expire, tokens that cannot be revoked, password resets that leak whether
an account exists.

**Injection.** Queries built by string concatenation. Shell commands assembled from input. File paths
built from user-controlled strings (`../../` still works). Requests whose destination URL comes from
input (server-side request forgery — the way an attacker reads cloud metadata). Deserialization of
untrusted data. `eval`, `new Function`, dynamic `import()` of a computed path. And **prompt
injection**: any text from a user, a document, a web page or a model that reaches a language model as
instructions, or whose output is then executed, written to disk, or trusted.

**Output and rendering.** Untrusted text rendered as HTML, `dangerouslySetInnerHTML` and its
equivalents, markdown rendered without sanitization, `javascript:` and `data:` URLs accepted as
links, user-controlled redirects, and any place a filename or user string ends up inside a page,
an email, or a log line unescaped.

**Requests and sessions.** State-changing operations reachable by `GET`. Missing cross-site request
forgery protection on form posts. `Access-Control-Allow-Origin: *` next to credentialed endpoints.
Cookies without `HttpOnly`, `Secure` or `SameSite`. Missing security headers. A content security
policy that allows `unsafe-inline` or `unsafe-eval` on pages that render user content.

**Validation.** Boundaries that accept whatever arrives — no schema, no type check, no length limit.
Object updates that write every field the caller sent, including the ones they should not control
(mass assignment). File uploads without a size cap, a type check, or a safe storage location.
Queries with no pagination that a caller can ask to return everything.

**Abuse and cost.** Login, signup, password reset, invite and one-time-code endpoints without rate
limiting. Anything expensive — a model call, an email, an export, an image job — that an anonymous
caller can trigger in a loop. Enumeration: an endpoint that answers differently for "this exists" and
"this does not".

**Cryptography and verification.** Hand-rolled crypto. Passwords stored with a fast hash or none.
Tokens compared with `===` where the comparison should be timing-safe. Randomness from
`Math.random()` where it must be unguessable. Webhooks accepted without verifying the sender's
signature — a payment webhook that anyone can call is a way to grant themselves anything the webhook
grants.

**Leakage.** Stack traces and database errors returned to the caller. Personal data, tokens, request
bodies or model output written to logs. Debug flags, verbose logging or development-only routes alive
in production builds. Source maps, `.env` files, backups or admin dashboards reachable in the deployed
output.

**Dependencies and pipeline.** Known advisories in the lockfile (run the project's own audit command
if it has one — see limit 2 above). Install-time scripts from packages nobody vetted. Unpinned or
mutable-tag actions in `{{CI_FILE}}`. Secrets printed by a pipeline step. Build steps that fetch a
script from the internet and run it. Storage buckets or object stores that are public when they
should not be.

## 4. Judge what you found

For every finding, write four things. Anything you cannot write all four for is a **suspicion**, and
it goes in the report labelled as one — never as a vulnerability.

1. **Severity** — `Critical` (someone can read or change other people's data, or take over the
   system, from the internet, today), `High` (the same, but needing an account or an unlikely
   precondition), `Medium` (real exposure with limits), `Low` (hardening; nothing exploitable found).
   Rate what an attacker can *do*, not how ugly the code is.
2. **The path** — how it is actually exploited, in one or two concrete sentences. "An account holder
   changes the id in `/api/projects/<id>` and reads another organization's project" is a path.
   "Improper access control" is a category.
3. **The evidence** — `file:line`. Every finding points at code you have read.
4. **Confidence** — certain, or what would have to be true for it to be real.

Rank by severity, then by how easy it is to reach. That ranking is the order you fix in and the order
the report lists.

## 5. Fix — and the line you do not cross

Some of these can be fixed right now. Some must be asked about first. Some are never yours.

**Fix now — invisible to anyone using the product:**

- Parameterize a query; escape or sanitize output.
- Add the server-side authorization check that should have been there, where the caller was already
  supposed to be denied.
- Validate a boundary that already rejects malformed input, so it now rejects it properly.
- Stop logging a secret, a token, or personal data.
- Verify a webhook signature; make a token comparison timing-safe; use a cryptographically secure
  random source.
- Remove a hard-coded secret from the code and read it from the environment instead — and say in the
  report that the key must be rotated, because it is in the history now.
- Tighten a permission, a file mode, a bucket policy or a pipeline scope that is broader than what
  the code actually uses.
- Add the security header or cookie flag that nothing in this project can be broken by (`HttpOnly` on
  a cookie no script reads, for instance) — if there is any doubt, it belongs in the next list.

**Ask first — anything a person could notice:**

- Anything that changes a page's appearance, its wording, a route, a URL or a flow.
- A new authentication or authorization requirement that shuts out someone who gets in today.
- A content security policy, or headers that can break embedding, analytics or third-party widgets.
- Rate limits, lockouts, captchas — they change what a legitimate user experiences.
- Dependency upgrades across a major version.
- Database migrations, schema changes, pipeline permissions, deployment configuration.

Collect these and put them to the founder **one at a time**, each with: what the risk is, exactly what
you would change, and what they would notice afterwards. Do only the ones they say yes to. A question
that gets a no — or no answer at all — becomes a proposal in the report, and nothing more. Silence is
not consent.

**Never:**

- Delete code, data, files or history to make a finding go away.
- Turn off a working feature "to be safe".
- Touch remotes, credentials, cloud accounts or anything outside this repository.
- Add a dependency, install a tool, or send anything anywhere.
- Rewrite git history, even to remove a leaked key. Report it and let the founder decide.

## 6. Verify before you call anything fixed

After the fixes, run the bar:

```bash
{{CMD_TYPECHECK}}
{{CMD_LINT}}
{{CMD_TEST}}
{{CMD_BUILD}}
```

All of them must be as green as they were when you started — note anything that was already failing
before you touched it, so a pre-existing failure is not mistaken for your doing.

**If a fix breaks any of them, revert that fix.** Put it back exactly as it was, and move the finding
into the report as something that needs a real change rather than a patch. A repository left broken by
a security fix is a worse outcome than the vulnerability, because it is the one thing that guarantees
the next person turns the fix off.

## 7. Write `SECURITY_AUDIT.md`

In the repository root, **rewritten from scratch every run** — it describes the repository as it is
today, not a stack of appended runs. What survives a rewrite is named below: the run log, every
finding ever raised, and every word a human wrote.

Sections, in this order:

0. **Run log** — one row per run, and no row is ever removed:

   | Run | Date and time | Commit | Found | Fixed | Left open |
   | --- | --- | --- | --- | --- | --- |
   | 1 | 2026-03-04 09:12 (+01:00) | `a1b2c3d` | 6 | 2 | 4 |
   | 2 | 2026-05-19 16:40 (+02:00) | `f4e5d6c` | 3 (1 regression) | 3 | 0 |

   Take the date **and the clock time, with the offset**, from the machine (`date`) rather than
   guessing at it. Two runs in one day is exactly what happens on the day somebody decides to fix
   things, and without the time nobody can tell which came first.

1. **Header** — the date and time of *this* run, the current commit, what was reviewed, and anything
   that was not (a tool that is missing, a directory too large to read, a check that needed the
   network).
2. **Summary** — counts per severity, how many were fixed, how many are waiting on the founder, and
   what changed since the last run: new, regressed, closed.
3. **Fixed** — one entry per fix: what it was, the severity, the exploitation path, `file:line`, what
   you changed, the date and time it was fixed, and that the verification bar is green. Entries from
   earlier runs stay here, with the run that closed them.
4. **Found, not fixed** — one entry per finding: severity, path, evidence, the fix you propose, and
   **why it was not done** (waiting for approval / needs a product decision / requires infrastructure
   / outside this repository). Then the suspicions, plainly labelled.
5. **Needs you, outside the code** — rotate this key, change that setting in the hosting dashboard,
   close that bucket, set that secret in the pipeline. The things no edit here can do.
6. **Checked and clean** — every category from section 3 that you reviewed and found nothing in. This
   is what makes the next run cheaper and tells the founder what "secure" currently covers.
7. **Next** — the prioritized list, worst first, in the order you would do them.

**The report never leaves this machine.** Before writing it, make sure `SECURITY_AUDIT.md` is in
`.gitignore` — add the line if it is missing, create the file if the project has none — and never
commit it. The reason is worth stating out loud: this file is a list of the ways into this project
that are still open. Committed to a repository, it is a map handed to whoever finds the repository.
It is the founder's working document, not a record.

If it was already committed in an earlier run, say so and tell the founder it should be removed from
tracking. Do not do it for them.

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

In the conversation, briefly: how many findings, split by severity; what changed since the last run
(new, regressed, closed) and what you re-verified from it; what you fixed and that the bar is green;
what is waiting for a decision from the founder; and the single most important thing to do next.
Point at `SECURITY_AUDIT.md` for the detail.

Say what you did not check as clearly as what you did. **Never report that the project is secure** —
report what was reviewed, what was found, and what remains. Anything you want changed but may not
change yourself goes through `/createspec`, like every other change to this project.
