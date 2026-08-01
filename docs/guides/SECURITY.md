# Security routines

What is automated, what is your job, and what to do when a gate stops you. The rules these implement
live in [`.claude/spec-kit/constitution.md`](../../.claude/spec-kit/constitution.md) (§VI: high-severity
advisories block a release; §Security: secrets never reach code, logs or generated output).

## What runs automatically

| Mechanism | Where | What it does |
| --------- | ----- | ------------ |
| Dependency audit | `Audit production dependencies` step in `ci.yml` | Fails the required `verify` check on a **new** high/critical advisory in a **production** dependency |
| Dependabot alerts | GitHub, repo setting | Notifies about known vulnerabilities in the Security tab |
| Secret scanning | GitHub, repo setting | Detects committed credentials |
| Push protection | GitHub, repo setting | **Blocks the push** before a credential enters history |

The two repo settings are applied by `scripts/setup-security-scanning.sh`, run by an admin. They are
free because this repository is public — if it ever goes private they need a paid plan.

**What runs when you ask: `/security`** (spec 157). It reads the whole repository, fixes what changes
nothing a user can see, asks before anything else, and writes the gitignored `SECURITY_AUDIT.md`. It
is the half CI cannot do — CI gates high/critical *production advisories*, and everything below that
line, plus every hole in our own code, only exists if somebody looks. Run it before a launch, and
whenever something new is exposed to the internet. A re-run re-verifies every entry in the last report
before looking for anything new.

**Actions are pinned to commit SHAs**, with the version as a trailing comment
(`actions/checkout@11d5960… # v4`). A tag can be repointed by whoever owns the action, and these
workflows hold the Supabase and Vercel secrets. Pinning froze the versions already in use; upgrading
them is a separate decision, and all four are behind their latest majors.

## The audit baseline

`.security/audit-baseline.json` lists advisories we have **accepted**. The check fails only on
advisories that are *not* in it.

This exists because the gate was introduced into a repo that already had 16 high/critical advisories in
production dependencies. Blocking on those would have stopped all work; ignoring them would have made
the check meaningless. The baseline is the honest middle: the debt is written down, in version control,
where a reviewer sees every line.

**The file is meant to shrink.** When an upgrade removes an advisory, the check prints a warning naming
the now-redundant rows. It does not fail — punishing a successful upgrade would be backwards.

> **As of 2026-08-01 all sixteen rows are stale:** `pnpm audit --prod` matches none of them, so CI is
> printing that warning on every run. The baseline has done its job and should be emptied — a file
> nobody trims stops being read, and a warning nobody acts on stops being seen. Noticed by the first
> `/security` run (spec 157); left as its own change, because removing an accepted risk is a decision,
> not housekeeping.

### Accepting an advisory

Only when there is no fix, or the fix is not viable yet. Add a row:

```json
{
  "id": "GHSA-xxxx-xxxx-xxxx",
  "severity": "high",
  "module": "some-package",
  "title": "…",
  "note": "No patched version yet; reachable only from X, which we don't call. Re-check <date>."
}
```

The `note` is the point. "Accepted" without a reason is indistinguishable from "ignored".

**Never** disable the check to get a PR through. A skipped gate leaves no trace; a baseline row does.

### Why `pnpm audit` and not the Dependabot API

Measured when the gate was built: Dependabot reported **0** advisories, `pnpm audit` reported **21**.
On top of that, `GITHUB_TOKEN` cannot read Dependabot alerts — Actions has no permission key for it, and
the REST API needs a fine-grained token with *Dependabot alerts (read)*. Putting a PAT in Actions is
forbidden (see `scripts/setup-branch-protection.sh` and constitution §II). `pnpm audit` needs no token.

### Why production dependencies only

`--prod`. A vulnerability in ESLint never reaches a user. The residual risk — dev tooling runs in CI with
access to the repo — is accepted deliberately, in exchange for a gate that stays believable and gets
acted on rather than muted.

## Dependabot pull requests are off

Dependabot's branches are named `dependabot/...` and target the default branch (`develop`).
`branch-policy.yml` allows only `feature/*` into `develop`, and `validate-source-branch` is a required
check there — so every Dependabot PR would be red and unmergeable. Alerts-only is a deliberate choice,
not an oversight. Enabling PRs requires an exception in the branch policy first; see
[`BRANCHING.md`](../architecture/BRANCHING.md).

Upgrades are therefore done by hand, in a normal issue branch.

## When push protection blocks you

It found something that looks like a credential in your push.

1. **Assume it is real.** Check what the string is before deciding it is a false positive.
2. **If it is a real credential:** rotate it first. Removing the commit is not enough — treat anything
   pushed to a public repo as compromised even if the push was blocked, since the value has been in a
   place you did not intend it to be.
3. **Get it out of the commit:** move the value to `.env.local` (gitignored) and amend or rebase. Never
   commit a real key with a plan to remove it later.
4. **If it genuinely is a false positive** (a test fixture, a documentation example): GitHub's block
   message links a page where you can allow it with a reason. Prefer changing the string to something
   obviously fake — `sk-example-not-a-real-key` — over recording an exception.

Only `apps/web/.env.example` is tracked; it contains key *names* and no values. `.env` and `.env.local`
are gitignored and must stay that way.

## Who looks at what

- **Every PR author:** the `verify` check tells you if you introduced an advisory. Nothing to remember.
- **Whoever merges to `develop`/`main`:** if the audit step warns about stale baseline rows, remove them.
  That is the mechanism by which the file shrinks — nobody else is going to do it.
- **Periodically, someone:** the Security tab for Dependabot and secret-scanning alerts. Alerts are not
  wired to the gate, so they need a human. If this repo ever grows past a couple of people, this line
  should name a rotation instead of "someone".
