// Invitations, and the week of Pro one earns (spec 122).
//
// Part of the data layer beside `store.ts` rather than inside it: these three tables are only ever
// touched together, only ever by this file, and the store is already the place where everything else
// lives. Server-side only, like every module in `lib/data` — the Supabase client here uses the
// service-role key, so every query is additionally scoped by organization_id (§II).
//
// The entitlement this produces is deliberately *not* `organizations.plan`. That column is Stripe's
// (specs 99, 100); a grant is a second, independent answer to "is this organization Pro", and the two
// are combined only where an entitlement is decided.
import crypto from "node:crypto";
import { db, maybe, rows, single } from "./supabase";
import { countGenerations } from "./store";

/** How long one invitation is worth. */
export const REFERRAL_GRANT_DAYS = 7;

/**
 * How many invitations one workspace can ever be paid for.
 *
 * This is the whole abuse story. Verification is free to manufacture and a mailing list is free to
 * buy, so the cost of a farm has to be bounded by something that does not depend on catching it.
 */
export const REFERRAL_CAP = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Postgres unique violation — the outcome we *want* from the idempotence constraints below. */
const UNIQUE_VIOLATION = "23505";

/** Where an invited workspace has got to, for the inviter's own list. */
export interface InviteStanding {
  attachedAt: string;
  /** `joined` — signed up and verified. `generated` — the invitation has been paid for. */
  state: "joined" | "generated";
  /** True when it matured after the cap was reached, so no week was credited for it. */
  uncredited: boolean;
}

/** Where an organization's earned weeks stand, without touching any of them. */
export interface GrantStanding {
  /** When the running week ends, or null when none is running. */
  activeUntil: string | null;
  /** Weeks earned and waiting — behind a subscription, or behind another week. */
  queued: number;
}

/** What the invite card shows. Read-only: looking at Settings must never start a week. */
export interface ReferralSummary extends GrantStanding {
  code: string;
  invites: InviteStanding[];
  /** Invitations that earned a week. */
  credited: number;
  remaining: number;
}

interface GrantRow {
  id: string;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
}

/**
 * The organization's invite code, created on first use.
 *
 * Never rotated. A link a founder has already pasted into a message has to keep working, so the code
 * outlives every session and there is no "regenerate" anywhere in the product.
 *
 * `randomBytes` rather than a counter or a slug: the code is the only thing standing between a
 * stranger and a referral attached to someone else's workspace, so it is 80 bits of nothing.
 */
export async function referralCode(orgId: string): Promise<string> {
  const existing = maybe<{ code: string }>(
    await db().from("referral_codes").select("code").eq("organization_id", orgId).maybeSingle()
  );
  if (existing) return existing.code;

  const code = crypto.randomBytes(10).toString("base64url");
  const insert = await db()
    .from("referral_codes")
    .insert({ organization_id: orgId, code })
    .select("code")
    .single();

  // Two tabs, two inserts, one primary key. The loser reads the winner's code rather than failing —
  // the founder asked for their link, not for a lecture about concurrency.
  if (insert.error) {
    if (insert.error.code !== UNIQUE_VIOLATION) throw new Error(`Supabase: ${insert.error.message}`);
    return referralCode(orgId);
  }
  return code;
}

/**
 * Record that `referredOrgId` arrived through `code`.
 *
 * Returns false — never throws — when the invitation does not apply: an unknown code, a founder
 * inviting themselves, or a workspace that already carries a referral. All three are ordinary things
 * for a link to do, and none of them may interrupt a signup that is otherwise fine.
 *
 * The second and third are enforced by the schema (`referrals_not_self`, and the unique constraint on
 * `referred_organization_id`) rather than by reading first: a check-then-insert would race with the
 * duplicate confirmation clicks this is most likely to see.
 */
export async function attachReferral(code: string, referredOrgId: string): Promise<boolean> {
  const owner = maybe<{ organization_id: string }>(
    await db().from("referral_codes").select("organization_id").eq("code", code).maybeSingle()
  );
  if (!owner) return false;

  const insert = await db().from("referrals").insert({
    referrer_organization_id: owner.organization_id,
    referred_organization_id: referredOrgId
  });
  if (!insert.error) return true;
  // 23505: already referred. 23514: the self-referral check. Both mean "no", and neither is a fault.
  if (insert.error.code === UNIQUE_VIOLATION || insert.error.code === "23514") return false;
  throw new Error(`Supabase: ${insert.error.message}`);
}

/**
 * Pay for the invitation that brought this organization here, if there is one.
 *
 * Called when a generation completes. Idempotent twice over: a referral that has already matured is
 * skipped, and an organization that never had one does nothing.
 *
 * The generation ledger is consulted rather than trusted from the caller. `generation_usage` gets a
 * row on job *insert*, and `countGenerations` is what subtracts the failures and the memoised runs
 * (`store.ts`) — so this asks the same question the allowance does, and a foundation that fell over on
 * our side earns nobody a week.
 */
export async function matureReferral(orgId: string, now: Date = new Date()): Promise<void> {
  const referral = maybe<{ id: string; referrer_organization_id: string }>(
    await db()
      .from("referrals")
      .select("id, referrer_organization_id")
      .eq("referred_organization_id", orgId)
      .is("matured_at", null)
      .maybeSingle()
  );
  if (!referral) return;
  if ((await countGenerations(orgId)) === 0) return;

  const credited = rows<{ id: string }>(
    await db()
      .from("referrals")
      .select("id")
      .eq("referrer_organization_id", referral.referrer_organization_id)
      .not("plan_grant_id", "is", null)
  );

  // Past the cap the referral is still recorded as matured, with no grant hanging off it. The invited
  // founder is unaffected and is told nothing: they came for the product, not for someone's quota.
  let grantId: string | null = null;
  if (credited.length < REFERRAL_CAP) {
    grantId = single<{ id: string }>(
      await db()
        .from("plan_grants")
        .insert({
          organization_id: referral.referrer_organization_id,
          source: "referral",
          duration_days: REFERRAL_GRANT_DAYS
        })
        .select("id")
        .single()
    ).id;
  }

  const update = await db()
    .from("referrals")
    .update({ matured_at: now.toISOString(), plan_grant_id: grantId })
    .eq("id", referral.id)
    .is("matured_at", null);
  if (update.error) throw new Error(`Supabase: ${update.error.message}`);
}

/** Grants for an organization, newest last — the order a queue is consumed in. */
async function grantsFor(orgId: string): Promise<GrantRow[]> {
  return rows<GrantRow>(
    await db()
      .from("plan_grants")
      .select("id, starts_at, expires_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
  );
}

function isActive(grant: GrantRow, now: Date): boolean {
  if (!grant.starts_at || !grant.expires_at) return false;
  return Date.parse(grant.starts_at) <= now.getTime() && now.getTime() < Date.parse(grant.expires_at);
}

/**
 * Where the earned weeks stand, changing nothing.
 *
 * This is what every screen uses. `claimPro` is what the two entitlement decisions use, and the split
 * is the whole point: `checkAllowance` runs on page renders as well as in actions, so a single
 * function that both answers and activates would start a founder's week because they opened a list of
 * their projects.
 */
export async function grantStanding(orgId: string, now: Date = new Date()): Promise<GrantStanding> {
  const grants = await grantsFor(orgId);
  return {
    activeUntil: grants.find((g) => isActive(g, now))?.expires_at ?? null,
    queued: grants.filter((g) => g.starts_at === null).length
  };
}

/**
 * Whether an earned week covers this organization right now — starting one if it has to.
 *
 * The only function that activates a grant, and it is called exclusively from the two places an
 * entitlement is actually decided: `checkAllowance`, and the import gate. That is what makes "the week
 * waits behind a subscription" true without predicting when the subscription ends — a Pro workspace
 * short-circuits before reaching here, so its queued weeks are never touched.
 *
 * It also means a founder who has an earned week does not spend a day of it reading Settings. Anything
 * that only reports uses `referralSummary` instead.
 *
 * Returns the ISO instant the covering week ends, or null.
 */
export async function claimPro(orgId: string, now: Date = new Date()): Promise<string | null> {
  const grants = await grantsFor(orgId);

  const running = grants.find((g) => isActive(g, now));
  if (running?.expires_at) return running.expires_at;

  const queued = grants.find((g) => g.starts_at === null);
  if (!queued) return null;

  const expiresAt = new Date(now.getTime() + REFERRAL_GRANT_DAYS * DAY_MS).toISOString();
  // Conditional on still being unstarted, so two concurrent generations cannot start the same week
  // twice — the second update matches nothing and reads the first one's window.
  const started = rows<{ expires_at: string }>(
    await db()
      .from("plan_grants")
      .update({ starts_at: now.toISOString(), expires_at: expiresAt })
      .eq("id", queued.id)
      .is("starts_at", null)
      .select("expires_at")
  );
  if (started[0]) return started[0].expires_at;

  // Somebody else started this week between the read and the write. Theirs is the one that counts.
  const reread = await grantsFor(orgId);
  return reread.find((g) => isActive(g, now))?.expires_at ?? null;
}

/**
 * Everything the invite card shows, and nothing that changes anything.
 *
 * Deliberately a separate function from `claimPro` rather than a flag on it: one of these two is safe
 * to call from a page render and the other is not, and a boolean argument is a poor place to keep a
 * distinction that matters this much.
 */
export async function referralSummary(orgId: string, now: Date = new Date()): Promise<ReferralSummary> {
  const sentQuery = db()
    .from("referrals")
    .select("attached_at, matured_at, plan_grant_id")
    .eq("referrer_organization_id", orgId)
    .order("attached_at", { ascending: true });

  const [code, sentResult, grants] = await Promise.all([
    referralCode(orgId),
    sentQuery,
    grantsFor(orgId)
  ]);
  const sent = rows<{ attached_at: string; matured_at: string | null; plan_grant_id: string | null }>(
    sentResult
  );

  const credited = sent.filter((r) => r.plan_grant_id !== null).length;

  return {
    code,
    invites: sent.map((r) => ({
      attachedAt: r.attached_at,
      state: r.matured_at ? "generated" : "joined",
      uncredited: r.matured_at !== null && r.plan_grant_id === null
    })),
    credited,
    remaining: Math.max(0, REFERRAL_CAP - credited),
    activeUntil: grants.find((g) => isActive(g, now))?.expires_at ?? null,
    queued: grants.filter((g) => g.starts_at === null).length
  };
}
