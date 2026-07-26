// Middleware-side Supabase client: refreshes the auth session cookie on every request
// and reports whether the requester is authenticated. Server-only (Edge middleware).
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; userId: string | null }> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Missing config is a broken deployment, not a signed-out visitor. Returning
  // `userId: null` here used to make every /app request bounce to /login with no
  // error anywhere — an unconfigured app looked exactly like a wrong password.
  if (!url || !key) {
    throw new Error(
      "Supabase Auth is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in apps/web/.env.local."
    );
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      }
    }
  });

  // `getClaims()` rather than `getUser()`: it verifies the JWT's signature locally when
  // the project uses asymmetric signing keys, turning a network round-trip on every
  // request into a local check. Where local verification isn't possible it falls back to
  // asking the auth server, so this is never weaker than what it replaces.
  //
  // Safe *because this gate is coarse*. It only decides "app or /login"; the
  // authoritative check is `getSession()`, which still calls `getUser()` once per request
  // and is what every RSC and action scopes its data by. A locally-verified token stays
  // valid until it expires, so revocation lands one short-lived token later here — and
  // immediately in the layer that actually reads data.
  const { data } = await supabase.auth.getClaims();
  return { response, userId: data?.claims.sub ?? null };
}
