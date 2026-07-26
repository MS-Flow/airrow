// Server-side Supabase client bound to the request cookies (anon key), for reading the
// authenticated user's session in RSC, server actions, and route handlers. Distinct from
// the service-role client in supabase.ts: this one runs *as the user*, so RLS applies.
// Server-only — never import from a client component.
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function config(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase Auth is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }
  return { url, key };
}

export async function supabaseServer(): Promise<SupabaseClient> {
  const store = await cookies();
  const { url, key } = config();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) store.set(name, value, options);
        } catch {
          // Called during a Server Component render, where cookies are read-only. Safe to
          // ignore — the middleware refreshes the session cookie on the next request.
        }
      }
    }
  });
}
