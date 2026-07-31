// Server-only Supabase client for the DataStore. Built from the service-role key, so it
// bypasses RLS — every caller must scope by organization_id server-side (defense in depth,
// constitution §II). Never import this from a client component. Real per-user auth (anon
// key + RLS enforcement) lands with the auth issue.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

export interface SupabaseError {
  message: string;
  code?: string;
}

type Res<T> = { data: T | null; error: SupabaseError | null };

/**
 * A table this code knows about and the database does not — a deployment running ahead of its
 * migrations.
 *
 * PostgREST answers `PGRST205` from its schema cache; Postgres itself reports `42P01`.
 */
export function isMissingTable(error: SupabaseError): boolean {
  return error.code === "PGRST205" || error.code === "42P01";
}

/**
 * `rows`, with one extra outcome: **null** when the table is not there yet.
 *
 * Distinct from `[]` on purpose — "this workspace has nothing" and "this deployment has no such
 * feature" look the same to a query and read very differently on a screen. Callers that render a
 * whole page around the answer use this so a database one migration behind costs a card rather than
 * the screen it sits on.
 */
export function rowsOrAbsent<T>(res: Res<T[]>): T[] | null {
  if (res.error) {
    if (isMissingTable(res.error)) return null;
    throw new Error(`Supabase: ${res.error.message}`);
  }
  return res.data ?? [];
}

/** Array result: throw on error, coalesce a null payload to an empty list. */
export function rows<T>(res: Res<T[]>): T[] {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data ?? [];
}

/** Optional single row: throw on error, return null when absent. */
export function maybe<T>(res: Res<T>): T | null {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data ?? null;
}

/** Required single row (e.g. insert…select().single()): throw on error or missing row. */
export function single<T>(res: Res<T>): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  if (res.data === null) throw new Error("Supabase: expected a row, got none");
  return res.data;
}
