# Spec 133 — The invite list says who, not just what

> **In one sentence:** An invitation that paid out should name the founder it came from, because three
> identical rows saying "Generated their foundation" tell the person who sent the links nothing.

|                |                                                      |
| -------------- | ---------------------------------------------------- |
| **Status**     | 🔄 In progress                                        |
| **Issue**      | #133 — "Invite-kortet ska namnge vem som genererat, inte bara att någon gjort det" |
| **Branch**     | `133-invite-names` (from `feature/pro`)               |
| **Feature**    | pro                                                   |
| **Depends on** | [spec 122](122-invite-a-friend.md) (the invite card and the referral tables) |

**Short on time?** Read _User story_ and _Acceptance criteria_ — that's the whole point of the change and
how you'll know it's done. Everything after those is detail for whoever implements and reviews it.

---

## User story

As a **founder who has sent their invite link to a few people** I want **each row to name the person it
is about** so that **I can tell my three invitations apart — and know who to nudge when one is still
sitting at "signed up".**

---

## Background

- **Today:** every row reads `<date> Generated their foundation — 7 days of Pro credited.`
  ([InviteCard.tsx](../apps/web/src/features/referrals/InviteCard.tsx)). With more than one invitation
  the rows are indistinguishable.
- **The problem:** the inviter knows *how many*, never *who*. The status that most needs a name is the
  one that has not paid out yet: "signed up, hasn't generated" is actionable only if you know who to ask.
- **Already in place:** `referrals` carries `referred_organization_id` (spec 122), so the name is one
  hop away rather than on the row; personal workspaces are named `"<name>'s workspace"` from the signup
  name, falling back to the email's local part
  ([20260725110000_auth.sql:32-40](../supabase/migrations/20260725110000_auth.sql#L32-L40)).

---

## Design decision

**The account's own name, with the workspace name as the fallback.** `profiles.display_name` is what the
founder typed at signup and reads naturally in a sentence. If there is no profile row, the workspace name
is derived from the same string and says the same thing; if neither exists, the row says "Someone" rather
than an empty gap.

**Read live, never stored on the referral.** Copying the name onto `referrals` at attach time would put
personal data in a second place, freeze it against a later rename, and leave existing rows nameless. One
lookup at render time avoids all three — and the rows already in the database get their names retroactively.

**Only the name crosses to the client.** No email, no user id, no organization id. The card is a list of
people the founder invited, not a directory.

**Not touched:** the referral tables, RLS, the entitlement, and every rule about when a week is earned or
spent. This spec changes one string per row.

---

## Acceptance criteria

- [x] Each invite row names the invited founder using their account name.
- [x] A missing profile falls back to the workspace name; both missing falls back to a neutral word.
- [x] The name is resolved server-side; the client receives no email, user id or organization id.
- [x] A card with no invitations issues no name lookups at all.
- [x] Existing rows — invitations that predate this change — show names too.
- [x] Typecheck passes; lint adds no new issues; tests green.

### Verification

- **New tests** — [`referrals.test.ts`](../apps/web/src/lib/data/referrals.test.ts) (6): the name from
  the profile, the fallback to the workspace name when there is no profile *and* when the profile's name
  is empty, the neutral fallback when neither exists, two invitations named separately, and — asserted
  through a recorded query log — that an empty card queries neither `organizations` nor `profiles`.
- **Extended** — [`settings/page.test.tsx`](../apps/web/src/app/app/settings/page.test.tsx): the rendered
  rows read "Ada Lovelace generated their foundation" and "Grace Hopper signed up".
- Nothing beyond the name reaches `InviteStanding`, so the client cannot receive an address or an id
  even by accident — enforced by the type, not by care.
- **Result:** `pnpm -r typecheck` clean · `pnpm -r lint` clean · `pnpm -r test` **476 passed, 53 skipped**
  (the `*.db.test.ts` suites — local Supabase not running).

---

## Exact changes (file:line)

1. **`apps/web/src/lib/data/referrals.ts`** — add `name` to `InviteStanding`, and resolve it inside
   `referralSummary` with two batched reads (`organizations` by id, `profiles` by the ids
   `organization_members` gives back). Skipped entirely when there are no invitations.
2. **`apps/web/src/features/referrals/InviteCard.tsx`** — put the name in the row's sentence.

**No change needed:** the migration, the RLS policies, and everything in `claimPro` / `matureReferral`.

---

## Data model

**No schema changes.** The name is read from tables that already exist.

---

## Security

The inviter's own RLS does not reach another account's profile — the server resolves the name and passes
down that one string. Deliberate and bounded: the link is secret and shared on purpose, the cap of three
limits how far it travels, and a first-and-last name without an address or any identifier is not a
contact detail. Nothing else about the invited account leaves the server.

---

## Edge cases

- **Invited account deleted** → the organization cascades away with it, so the referral row goes too;
  nothing to name.
- **Founder signed up without a name** → both the profile and the workspace name derive from the email's
  local part, so the row shows that rather than an address.
- **Two invitations from people with the same name** → the date distinguishes them; nothing more is
  needed for a list capped at three.

---

## Out of scope

- Showing the invited founder's email, or any way to contact them from Airrow.
- Telling the invited founder who invited them.
