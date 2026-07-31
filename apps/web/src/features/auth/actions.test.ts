// The redirect target both OAuth actions hand to Supabase (spec 140).
//
// Supabase matches `redirectTo` against a redirect allow-list — `supabase/config.toml` for the local
// stack, `REDIRECT_URLS` in `scripts/sync-supabase-auth.mjs` for the hosted project — and every entry in
// both is an exact path. A target carrying anything extra stops matching and Supabase refuses the
// redirect, so a change that only meant to add Google would have taken GitHub down with it.
//
// This is the regression test for that: the failure lives inside Supabase, where asserting on the app's
// own behaviour cannot see it, so the assertion has to be on the URL itself.
import { describe, expect, it, vi, beforeEach } from "vitest";

const signInWithGitHub = vi.hoisted(() => vi.fn());
const signInWithGoogle = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({ signInWithGitHub, signInWithGoogle }));
vi.mock("@/lib/site-url", () => ({ requestOrigin: async () => "https://airrow.test" }));
vi.mock("next/navigation", () => ({ redirect }));

import { signInWithGitHubAction, signInWithGoogleAction } from "./actions";

/**
 * The allow-list spells this as origin + `/auth/callback` and nothing else, so that is asserted whole
 * rather than mirrored as a list this file could never keep in step with the real one.
 */
const EXACT_TARGET = "https://airrow.test/auth/callback";

const cases = [
  { name: "GitHub", run: signInWithGitHubAction, provider: signInWithGitHub },
  { name: "Google", run: signInWithGoogleAction, provider: signInWithGoogle }
] as const;

beforeEach(() => {
  signInWithGitHub.mockReset().mockResolvedValue({ url: "https://provider.test/authorize" });
  signInWithGoogle.mockReset().mockResolvedValue({ url: "https://provider.test/authorize" });
  redirect.mockReset();
});

describe.each(cases)("$name sign-in", ({ run, provider }) => {
  it("sends the exact redirect target the allow-list contains", async () => {
    await run();

    expect(provider).toHaveBeenCalledWith(EXACT_TARGET);
  });

  it("puts no query string on the target", async () => {
    await run();

    const [target] = provider.mock.calls[0] as [string];
    expect(new URL(target).search).toBe("");
  });

  it("sends the founder to the provider when one is returned", async () => {
    await run();
    expect(redirect).toHaveBeenCalledWith("https://provider.test/authorize");
  });
});

describe("a provider that will not start", () => {
  it("names GitHub without repeating the provider's own wording", async () => {
    signInWithGitHub.mockResolvedValue({ error: "provider disabled" });

    await signInWithGitHubAction();

    expect(redirect).toHaveBeenCalledWith("/login?error=github");
  });

  it("names Google, not GitHub", async () => {
    signInWithGoogle.mockResolvedValue({ error: "provider disabled" });

    await signInWithGoogleAction();

    expect(redirect).toHaveBeenCalledWith("/login?error=google");
  });
});
