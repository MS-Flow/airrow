import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { updateSession } from "./supabase-middleware";

// Regression test: a misconfigured deployment used to return `userId: null`, which
// the middleware read as "signed out" and redirected every /app request to /login —
// silently, forever. Misconfiguration must be loud.

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

let savedUrl: string | undefined;
let savedAnon: string | undefined;

beforeEach(() => {
  savedUrl = process.env[URL_KEY];
  savedAnon = process.env[ANON_KEY];
});

afterEach(() => {
  if (savedUrl === undefined) delete process.env[URL_KEY];
  else process.env[URL_KEY] = savedUrl;
  if (savedAnon === undefined) delete process.env[ANON_KEY];
  else process.env[ANON_KEY] = savedAnon;
});

describe("updateSession", () => {
  it("throws instead of reporting a signed-out user when Supabase is not configured", async () => {
    delete process.env[URL_KEY];
    delete process.env[ANON_KEY];

    await expect(updateSession(new NextRequest("http://localhost:3000/app"))).rejects.toThrow(
      /not configured/i
    );
  });

  it("names the file the keys belong in", async () => {
    delete process.env[URL_KEY];
    delete process.env[ANON_KEY];

    await expect(updateSession(new NextRequest("http://localhost:3000/app"))).rejects.toThrow(
      /apps\/web\/\.env\.local/
    );
  });
});
