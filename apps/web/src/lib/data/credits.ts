// Generations handed back by support (spec 150).
//
// Part of the data layer beside `store.ts`, like `referrals.ts` and for the same reason: one table,
// only ever touched here. Server-side only — the client uses the service-role key, so every query is
// additionally scoped by organization_id (§II).
//
// Deliberately *not* in `admin.ts`, even though only an admin can create one. `checkAllowance` reads
// these on behalf of the founder whose workspace they belong to, which is an ordinary org-scoped read;
// `admin.ts` is the module that crosses the tenancy boundary, and putting an org-scoped read there
// would blur the one distinction that makes it reviewable.
//
// One row is one generation. There is no `amount` column — see the migration for why.
import { db, rows, rowsOrAbsent } from "./supabase";

export interface CreditRecord {
  id: string;
  reason: string;
  grantedBy: string | null;
  grantedAt: string;
  consumedAt: string | null;
}

interface CreditRow {
  id: string;
  reason: string;
  granted_by: string | null;
  granted_at: string;
  consumed_at: string | null;
}

const CREDIT_COLUMNS = "id, reason, granted_by, granted_at, consumed_at";

const toCredit = (r: CreditRow): CreditRecord => ({
  id: r.id,
  reason: r.reason,
  grantedBy: r.granted_by,
  grantedAt: r.granted_at,
  consumedAt: r.consumed_at
});

/**
 * Unspent credits on this workspace.
 *
 * Zero while the database is behind this spec's migration rather than an error: this is read on the
 * path that decides whether a founder may generate, and a deployment one migration behind must fall
 * back to the ordinary allowance instead of taking the interview screen down.
 */
export async function creditsAvailable(orgId: string): Promise<number> {
  const found = rowsOrAbsent<{ id: string }>(
    await db()
      .from("generation_credits")
      .select("id")
      .eq("organization_id", orgId)
      .is("consumed_at", null)
  );
  return found?.length ?? 0;
}

/**
 * Spend the oldest unspent credit, if there is one. Returns whether one was spent.
 *
 * Conditional on still being unspent (`.is("consumed_at", null)`), so two generations started at once
 * cannot spend the same credit twice — the second update matches nothing and the caller is told no.
 * The same shape `claimPro` uses to start a referral week exactly once.
 *
 * Only `claimAllowance` calls this. Reporting where a founder stands must never spend anything, which
 * is why `creditsAvailable` exists as a separate function rather than a flag on this one.
 */
export async function consumeCredit(orgId: string, now: Date = new Date()): Promise<boolean> {
  const found = rowsOrAbsent<{ id: string }>(
    await db()
      .from("generation_credits")
      .select("id")
      .eq("organization_id", orgId)
      .is("consumed_at", null)
      .order("granted_at", { ascending: true })
      .limit(1)
  );
  const oldest = found?.[0];
  if (!oldest) return false;

  const claimed = rows<{ id: string }>(
    await db()
      .from("generation_credits")
      .update({ consumed_at: now.toISOString() })
      .eq("id", oldest.id)
      .is("consumed_at", null)
      .select("id")
  );
  return claimed.length > 0;
}

/**
 * Hand back `count` generations, one row each.
 *
 * The caller has already established that the actor is an admin — this module does not gate, it
 * writes. The audit row is the action's job, not this one's: a credit and the record of granting it
 * are two facts, and only the second one is about who we are.
 */
export async function grantCredits(input: {
  orgId: string;
  count: number;
  reason: string;
  grantedBy: string;
}): Promise<CreditRecord[]> {
  const payload = Array.from({ length: input.count }, () => ({
    organization_id: input.orgId,
    reason: input.reason,
    granted_by: input.grantedBy
  }));
  return rows<CreditRow>(
    await db().from("generation_credits").insert(payload).select(CREDIT_COLUMNS)
  ).map(toCredit);
}

/** Unspent credits for several workspaces at once, so a list of users is one query rather than N. */
export async function creditsAvailableFor(orgIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (orgIds.length === 0) return counts;

  const found =
    rowsOrAbsent<{ organization_id: string }>(
      await db()
        .from("generation_credits")
        .select("organization_id")
        .in("organization_id", orgIds)
        .is("consumed_at", null)
    ) ?? [];
  for (const row of found) {
    counts.set(row.organization_id, (counts.get(row.organization_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * How many generations one grant may hand back.
 *
 * A ceiling rather than a free number because this is a support gesture, not a plan: anything past a
 * handful is someone who should be on Pro, and a typo in a form should not be able to mint fifty.
 */
export const MAX_CREDITS_PER_GRANT = 10;

/** Narrow an untrusted count from a form to something this module will write. */
export function clampCreditCount(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_CREDITS_PER_GRANT, Math.max(1, Math.trunc(value)));
}
