// The numbers the free plan is made of (spec 74).
//
// Deliberately a module with no imports. `allowance.ts` reaches the DataStore and is server-only,
// but the landing page states these same numbers in prose — and a fact lives in exactly one file
// (§IV). Splitting the constants out is what lets the marketing copy and the enforcement read the
// same source without dragging Supabase into a client bundle.

/** Free generations per organization, ever. Pro replaces this rather than raising it. */
export const FREE_GENERATION_LIMIT = 1;

/**
 * Free repairs on a project that has already been generated once.
 *
 * One free foundation makes the first interview all-or-nothing, and a founder who mistypes an answer
 * would otherwise be permanently out with nothing to show. A repair is bounded twice over — by this
 * count and by the window below — so a free organization can cause at most
 * `FREE_GENERATION_LIMIT + FREE_REPAIR_LIMIT` charged Claude calls and never one more.
 */
export const FREE_REPAIR_LIMIT = 2;

/** How long the repair window stays open after a project's first generation. */
export const REPAIR_WINDOW_HOURS = 24;
