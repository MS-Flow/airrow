// A branch deploy shares the database with everything else, so this code can reach it before its
// migration does — and it did: writing a refused generation's flagged answers came back "Could not
// find the 'rejected_answers' column of 'generation_jobs' in the schema cache", which failed the job
// with a Supabase error instead of telling the founder what to rewrite (spec 128).
//
// Note the error shape. A write never reaches Postgres: PostgREST rejects it against its own schema
// cache first, so this is `PGRST204` and not the `42703` the older compatibility path matches.
import { beforeEach, describe, expect, it, vi } from "vitest";

const MISSING_COLUMN = {
  code: "PGRST204",
  message: "Could not find the 'rejected_answers' column of 'generation_jobs' in the schema cache"
};

let columnMissing = false;
const updates = vi.hoisted(() => [] as Record<string, unknown>[]);

const dbMock = vi.hoisted(() => ({
  from: vi.fn(() => {
    let payload: Record<string, unknown> = {};
    const chain = {
      update(row: Record<string, unknown>) {
        payload = row;
        updates.push(row);
        return chain;
      },
      eq: async () => {
        if (columnMissing && "rejected_answers" in payload) return { data: null, error: MISSING_COLUMN };
        return { data: null, error: null };
      }
    };
    return chain;
  })
}));

vi.mock("./supabase", async () => {
  const actual = await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, db: vi.fn(() => dbMock) };
});

const { updateJob } = await import("./store");

const rejection = {
  status: "failed" as const,
  error: "Your answer to “What problem are you solving, and who has it?” doesn't describe a software product yet.",
  rejectedAnswers: ["problem" as const]
};

describe("recording a refused generation before its migration has landed", () => {
  beforeEach(() => {
    columnMissing = false;
    updates.length = 0;
    dbMock.from.mockClear();
  });

  it("writes the flagged answers when the column is there", async () => {
    await updateJob("job1", rejection);

    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: "failed", rejected_answers: ["problem"] });
  });

  it("still records the refusal when the column is not", async () => {
    // What the founder must not lose is the explanation, and that travels in `error`. Only the
    // per-question marks are given up.
    columnMissing = true;

    await expect(updateJob("job1", rejection)).resolves.toBeUndefined();

    expect(updates).toHaveLength(2);
    expect(updates[1]).toMatchObject({ status: "failed", error: rejection.error });
    expect(updates[1]).not.toHaveProperty("rejected_answers");
  });

  it("still throws on an error that is not the missing column", async () => {
    // The tolerance is for one known column on one known write. Everything else is a real failure and
    // has to stay one.
    dbMock.from.mockImplementationOnce(() => {
      const chain = {
        update: () => chain,
        eq: async () => ({ data: null, error: { code: "23503", message: "insert violates foreign key" } })
      };
      return chain;
    });

    await expect(updateJob("job1", rejection)).rejects.toThrow("insert violates foreign key");
  });
});
