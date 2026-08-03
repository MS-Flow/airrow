# Spec 203 — The three moments worth interrupting someone for

> **In one sentence:** A Slack message when somebody signs up, creates a project, or buys Pro — with
> the workspace named, which is why it comes from our database and not from PostHog.

|                |                                      |
| -------------- | ------------------------------------ |
| **Status**     | 🔄 In progress                       |
| **Issue**      | #203 — "Slack notifications when a foundation is generated and when someone buys Pro" |
| **Branch**     | `203-slack-notifications` (from `feature/infrastructure`) |
| **Feature**    | infrastructure                       |
| **Depends on** | [spec 182](182-posthog-funnel.md) (the emit sites, and the reason this is not simply a PostHog destination) · [spec 99](99-stripe-checkout.md) / [spec 100](100-pro-upgrade-revisions.md) (where a payment becomes true) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

_Who wants this, and what they get out of it._

As **the person who runs Airrow** I want **a Slack message the moment somebody signs up, starts a
project, or buys Pro** so that **in launch week I find out from a notification rather than by
remembering to open a dashboard — and know which workspace it was, so I can follow up.**

---

## Background

_How things work today and what's wrong with that — grounded in real code._

- **Today:** nothing notifies anybody. There is no Slack integration anywhere in the repository.
- **Why not PostHog's Slack destination:** it exists, it is zero code, and it was tried first. The
  events it holds carry only what spec 182 deliberately puts in them — opaque ids and enums — so the
  message reads *"foundation_generated · project 8f3a1c… · reused false"*. Adding a workspace name to
  the analytics events to make Slack nicer is the one thing that must not happen: the privacy policy
  states in the visitor's own words that PostHog receives no name and no title.
- **So a readable notification is assembled where the readable data already lives** — Postgres.
- **Already in place:** `captureSignup` ([signup.ts](../apps/web/src/features/analytics/signup.ts))
  already resolves the workspace and decides whether an arrival is a *new* account; `capturePaid`
  ([paid.ts](../apps/web/src/features/billing/paid.ts)) already decides whether a Stripe event is a
  *new* customer rather than a renewal. Both rules are reused rather than written a second time.
  `lib/email.ts` (Resend, spec 144) is the precedent for outbound HTTP that no-ops without a key.

**Scope changed after the issue was written.** The issue asked for *foundation generated* + *bought
Pro*. What is actually wanted, and what this spec builds, is **user created · project created · bought
Pro**. `foundation_generated` is left to PostHog. Worth knowing that a created project is a *weaker*
signal than a generated foundation — a project can be created and abandoned before a single question
is answered — so this notification will fire more often than value is delivered.

---

## Design decision

_The approach we picked, and what we deliberately leave alone._

**An incoming webhook, one channel, three sentences.** One URL in the environment, no Slack app to
review, no bot token, no scopes, nothing to maintain. It is the smallest credential that does the job,
and the job is three short messages.

**What a message may name: the workspace, and the project.** Both are strings a founder typed, and
both are what makes the notification worth reading. **No email address** — a Slack channel is
searchable by everyone in the workspace and retained by Slack, and an address list accumulating in a
chat history is a different thing from a notification. Who someone is can be looked up in the admin
console, which is behind a login and access-controlled.

**Fire-and-forget, on the same terms as analytics.** Never awaited by the thing it reports on, never
throws into it, a no-op when unconfigured. A Stripe webhook that 500s because Slack was slow is a
webhook Stripe retries, about a payment that already worked.

**Founder-typed text is escaped, never interpolated.** Workspace and project names are untrusted
(§III). A workspace named `<!channel>` must not ping everyone, and one named `<https://evil|Click>`
must not render as a link.

**Not touched:** PostHog. The events stay exactly as spec 182 defined them, carrying no names — this
spec exists precisely so that they do not have to change.

---

## Acceptance criteria

_What "done" means. Every line is something a reviewer can check._

- [x] A message arrives when a **new account** is created, naming the workspace and how they signed in.
- [x] A message arrives when a **project is created**, naming the workspace and the project — from all
      three paths that create one: the new-project form, an import, and a claimed guest draft.
- [x] A message arrives when an organization **becomes Pro**, naming the workspace and whether it was
      monthly, yearly or a founding place.
- [x] **No message fires twice for one event.** A returning founder signing in is not a signup; a
      Stripe redelivery, renewal or plan reconciliation is not a new customer.
- [x] **Nothing a founder can see depends on Slack.** With Slack unreachable, slow, or the webhook
      unset, signup completes, the project is created, and the Stripe webhook still answers 200.
- [x] The deployment runs normally with **no Slack configuration at all** — no crash, no error logged
      on every request.
- [x] Only the workspace name, project name and plan tier are sent. No email, no interview answers, no
      generated document content.
- [x] Founder-typed names are escaped, so no message can ping a channel or forge a link.
- [x] The webhook URL is server-side only and never reaches a client bundle.
- [x] Typecheck passes; lint adds no new issues; tests green (note known pre-existing failures).

### Verification

_How each criterion above is proven._

- **New tests** — `messages.ts`: what each of the three messages says, and that `<`, `>` and `&` in a
  founder-typed name are escaped rather than passed through.
- **New tests** — `lib/slack.ts`: unconfigured is a silent no-op that never calls `fetch`; a rejected
  or slow send never reaches the caller.
- **New tests** — the emitters: one message per signup / project / conversion, and **none** for a
  returning sign-in, a renewal or a redelivery.
- **Manual** — a real signup, a real project and a real upgrade in production, all three landing in
  the channel.
- Full suite result + typecheck/lint status.

### Implementation notes (2026-08-03)

**30 new tests** — `messages.test.ts` (17), `lib/slack.test.ts` (8), plus 3 in `signup.test.ts` and 2
in `paid.test.ts`. Half of the message tests are about escaping, because that is where a founder-typed
name becomes a stranger deciding what our internal channel does.

**Result:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` **1480 passed, 0 failed**
(113 schemas · 305 engine · 1062 web; 103 skipped, unchanged).

**One deviation from the plan.** `notifyPaid` takes an `orgId` and does its own workspace lookup
inside the fire-and-forget, rather than being handed a name. `capturePaid`'s callers hold only an id,
and threading a name through the Stripe webhook and the reconciliation path would have put a database
read on the critical path of a payment to buy a nicer chat message. The read now happens where a
failure costs nothing.

---

## Exact changes (file:line)

1. **`apps/web/src/lib/slack.ts`** (new) — the transport. Reads `SLACK_WEBHOOK_URL`, no-ops without
   it, never throws, never awaited. The only place the URL is read.
2. **`apps/web/src/features/notifications/messages.ts`** (new) — pure builders and the escaper.
   Separate from the transport so what is *said* is testable without a network, and so the complete
   list of what may be sent is readable in one file — the same shape `events.ts` has for PostHog.
3. **`apps/web/src/features/notifications/notify.ts`** (new) — the three functions the rest of the
   app calls. Each returns `void` and swallows its own failures, so no caller can accidentally await
   one into a critical path.
4. **`features/analytics/signup.ts`** — `notifyUserCreated` beside `capture`, inside the freshness
   guard that already distinguishes a signup from a sign-in.
5. **`features/billing/paid.ts`** — `notifyPaid` beside `capture`, inside `isNewConversion`.
6. **The three project paths** — `features/projects/actions.ts`, `features/import/actions.ts`,
   `features/interview/claim-action.ts`. Each already holds the session's `org`, so each passes the
   name it already has.
7. **`lib/data/store.ts`** — `getOrganization(orgId)`, a scoped read of one row. Nothing like it
   existed; `getOrgForUser` takes a user.
8. **`apps/web/.env.example`** + **`docs/guides/INFRASTRUCTURE_SETUP.md`** — the variable and how to
   create the webhook in Slack, in the same change as the code that reads it.

**No change needed:** `features/analytics/events.ts` and the PostHog transports — unchanged, which is
the point of this spec.

---

## Data model

**No schema changes.** Every field in a message already exists in Postgres. Nothing about a
notification is recorded: a Slack message is a side effect, not a record, and the record of a signup
or a project is the row that already exists.

---

## Security

Sends three kinds of product event to a third party (Slack) that has not previously received any
Airrow customer data, over a server-side webhook URL that never enters a client bundle. **What is sent
is a closed list** — workspace name, project name, plan tier — chosen so that a chat history retained
and searched by everyone in the workspace never accumulates an address list. Founder-typed names are
escaped, so a name cannot ping a channel or forge a link. Nothing is read from Slack and no inbound
endpoint is created.

---

## Edge cases

- **No Slack configured** (local, preview, a fork) → no send, no error line on every request.
- **Slack is down, slow, or rate-limiting** → every caller completes normally. Slack rate-limits per
  webhook, and a launch spike is exactly when that happens.
- **A returning founder signs in** → no message. Both auth routes run on every sign-in.
- **A Stripe redelivery, renewal, or a founder opening the billing screen** → no second message.
- **A workspace or project name containing `<`, `>` or `&`** → escaped, sent as text.
- **A very long name** → truncated, so one workspace cannot make an unreadable message.
- **A workspace that vanished between the payment and the lookup** → the message still sends, naming
  the plan without the workspace. A missing name must not cost the notification.

---

## Out of scope

- **`foundation_generated`.** Left to PostHog — see the scope note in _Background_.
- **Notifications for anything else.** Downloads, failed generations, support tickets and cancellations
  are each defensible and none is asked for here.
- **A second channel, per-event routing, or configurable filters.** One channel, three messages.
- **Reading anything from Slack** — no slash commands, no interactivity, no inbound endpoint.
- **Notifying the founder.** These messages are for us.
- **A delivery log.** Postgres already answers what happened; a table to audit the convenience is more
  machinery than the problem deserves.
