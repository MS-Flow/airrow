// What Postgres promises about the landing chat's budget (spec 141).
//
// The unit tests above the database can prove the arithmetic; only these can prove the two things
// that actually protect the spend: that the ceilings are enforced inside one transaction rather than
// approximately, and that a browser session cannot touch the counters at all. This table is the one
// resource in the schema with no organization_id (§II, amended by spec 141), so "nobody may read it"
// is doing the work tenancy does everywhere else — and a denial test is the only thing that says so.
//
// Runs against local Supabase (`supabase start`); skipped when the DB is unreachable.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Client } from "pg";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/** Own bucket names, so a parallel suite cannot collide with this one's counters. */
const VISITOR = "test-visitor-141";
const OTHER = "test-visitor-141-b";

async function reachable(): Promise<boolean> {
  const probe = new Client({ connectionString: DB_URL, connectionTimeoutMillis: 1500 });
  try {
    await probe.connect();
    await probe.end();
    return true;
  } catch {
    return false;
  }
}

const dbUp = await reachable();

describe.skipIf(!dbUp)("chat rate limits (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
  });

  afterAll(async () => {
    await cleanup();
    await db.end();
  });

  beforeEach(cleanup);

  async function cleanup(): Promise<void> {
    await db.query("delete from public.chat_rate_limits where bucket in ($1,$2,'global')", [
      VISITOR,
      OTHER
    ]);
  }

  /** One claim, with the ceilings the caller wants for this scenario. */
  async function claim(bucket: string, visitorLimit = 5, globalLimit = 250): Promise<string> {
    const res = await db.query("select public.claim_chat_answer($1,$2,$3) as verdict", [
      bucket,
      visitorLimit,
      globalLimit
    ]);
    return res.rows[0].verdict;
  }

  async function answersIn(bucket: string): Promise<number> {
    const res = await db.query(
      "select answers from public.chat_rate_limits where bucket = $1 and day = (now() at time zone 'utc')::date",
      [bucket]
    );
    return res.rows[0]?.answers ?? 0;
  }

  it("allows an answer and counts it against both ceilings", async () => {
    expect(await claim(VISITOR)).toBe("ok");

    expect(await answersIn(VISITOR)).toBe(1);
    expect(await answersIn("global")).toBe(1);
  });

  it("refuses the visitor past their own ceiling, and stops charging the day for it", async () => {
    for (let i = 0; i < 3; i++) expect(await claim(VISITOR, 3)).toBe("ok");

    expect(await claim(VISITOR, 3)).toBe("visitor");
    expect(await answersIn(VISITOR)).toBe(3);
    // The refused claim must not have moved the global counter — a visitor who is out of answers
    // cannot be used to drain the day.
    expect(await answersIn("global")).toBe(3);
  });

  it("refuses everyone past the day's ceiling and gives the visitor their answer back", async () => {
    expect(await claim(OTHER, 5, 1)).toBe("ok");

    expect(await claim(VISITOR, 5, 1)).toBe("global");
    // Claimed first, then handed back: nobody pays a personal allowance for an answer the day could
    // not afford.
    expect(await answersIn(VISITOR)).toBe(0);
    expect(await answersIn("global")).toBe(1);
  });

  it("counts visitors separately", async () => {
    expect(await claim(VISITOR, 1)).toBe("ok");

    expect(await claim(VISITOR, 1)).toBe("visitor");
    expect(await claim(OTHER, 1)).toBe("ok");
  });

  it("releases an answer without ever handing out free allowance", async () => {
    await claim(VISITOR);
    await db.query("select public.release_chat_answer($1)", [VISITOR]);

    expect(await answersIn(VISITOR)).toBe(0);
    expect(await answersIn("global")).toBe(0);

    // A release that arrives twice, or for a day with nothing on it, must not go negative.
    await db.query("select public.release_chat_answer($1)", [VISITOR]);
    expect(await answersIn(VISITOR)).toBe(0);
    expect(await answersIn("global")).toBe(0);
  });

  it("refuses to let a caller claim the reserved global bucket as a visitor", async () => {
    await expect(claim("global")).rejects.toThrow(/reserved/);
  });

  /** Run as an authenticated user, under RLS, then roll back whatever it did. */
  async function asUser<T>(run: () => Promise<T>): Promise<T> {
    await db.query("begin");
    try {
      await db.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: "00000000-0000-0000-0000-000000000141" })
      ]);
      await db.query("select set_config('role', 'authenticated', true)");
      return await run();
    } finally {
      await db.query("rollback");
    }
  }

  it("denies a signed-in browser every way into the counters", async () => {
    await claim(VISITOR);

    // Reading is refused too, not only writing: a counter a browser can read is a counter it can be
    // shown to have room in, which is half of knowing when abuse is cheap.
    await asUser(async () => {
      await expect(db.query("select * from public.chat_rate_limits")).rejects.toThrow(/permission/i);
    });

    await asUser(async () => {
      await expect(
        db.query("insert into public.chat_rate_limits (bucket, day, answers) values ('x', current_date, 0)")
      ).rejects.toThrow(/permission/i);
    });

    await asUser(async () => {
      await expect(db.query("update public.chat_rate_limits set answers = 0")).rejects.toThrow(
        /permission/i
      );
    });
  });

  it("denies a signed-in browser the functions that write them", async () => {
    // `execute` on these is the same privilege as `insert` on the table — and worse for the release
    // one, which would hand out allowance a call at a time.
    await asUser(async () => {
      await expect(db.query("select public.claim_chat_answer($1,5,250)", [VISITOR])).rejects.toThrow(
        /permission/i
      );
    });

    await asUser(async () => {
      await expect(db.query("select public.release_chat_answer($1)", [VISITOR])).rejects.toThrow(
        /permission/i
      );
    });
  });
});
