// A deployment whose database is behind `20260729120000_pro_plan.sql` answered every allowance read
// with `column generation_jobs.reused_authoring does not exist`, which is a 500 on the interview
// screen — the screen whose only job there is to tell the founder where they stand. The ledger read
// has to survive a column it cannot see, and still exclude the failed jobs it always excluded.
import { beforeEach, describe, expect, it, vi } from "vitest";

let missingReusedColumn = false;
let jobsError: { message: string; code?: string } | null = null;

interface Row {
  id: string;
  status: string;
  reused_authoring?: boolean;
}

const jobRows: Row[] = [];
const usageRows: { generation_job_id: string | null; created_at: string }[] = [];

const dbMock = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    let selection = "";
    const buildResponse = () => {
      if (table === "generation_usage") return { data: usageRows, error: null };

      if (table === "generation_jobs") {
        if (jobsError) return { data: null, error: jobsError };
        if (selection.includes("reused_authoring") && missingReusedColumn) {
          return {
            data: null,
            error: {
              message: "column generation_jobs.reused_authoring does not exist",
              code: "42703"
            }
          };
        }
        const data = selection.includes("reused_authoring")
          ? jobRows
          : jobRows.map(({ id, status }) => ({ id, status }));
        return { data, error: null };
      }

      throw new Error(`Unexpected query: ${table} ${selection}`);
    };

    const chain = {
      select(value: string) {
        selection = value;
        return chain;
      },
      eq() {
        return chain;
      },
      in() {
        return chain;
      },
      then(onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
        return Promise.resolve(buildResponse()).then(onFulfilled, onRejected);
      }
    };
    return chain;
  })
}));

vi.mock("./supabase", async () => {
  const actual = await vi.importActual<typeof import("./supabase")>("./supabase");
  return { ...actual, db: vi.fn(() => dbMock) };
});

const { countGenerations } = await import("./store");

function ledger(jobs: Row[]): void {
  jobRows.length = 0;
  usageRows.length = 0;
  jobs.forEach((job, i) => {
    jobRows.push(job);
    usageRows.push({ generation_job_id: job.id, created_at: `2026-07-2${i + 1}T00:00:00.000Z` });
  });
}

describe("countGenerations with a stale schema", () => {
  beforeEach(() => {
    missingReusedColumn = false;
    jobsError = null;
    dbMock.from.mockClear();
  });

  it("excludes reused authoring when the column is there", () => {
    ledger([
      { id: "j1", status: "completed", reused_authoring: false },
      { id: "j2", status: "completed", reused_authoring: true }
    ]);

    return expect(countGenerations("org1")).resolves.toBe(1);
  });

  it("counts every completed job when the column is missing, instead of failing", async () => {
    // No column means no job can have reused a payload, so the count is what it was before the
    // column existed. Erring towards counting is the safe direction for a ceiling.
    ledger([
      { id: "j1", status: "completed", reused_authoring: false },
      { id: "j2", status: "completed", reused_authoring: true }
    ]);
    missingReusedColumn = true;

    await expect(countGenerations("org1")).resolves.toBe(2);
  });

  it("still excludes failed jobs on the fallback path", async () => {
    // The fallback drops one condition, not both: Airrow never paid for a job that fell over.
    ledger([
      { id: "j1", status: "completed", reused_authoring: false },
      { id: "j2", status: "failed", reused_authoring: false }
    ]);
    missingReusedColumn = true;

    await expect(countGenerations("org1")).resolves.toBe(1);
  });

  it("throws on any other error, so a real mistake stays loud", async () => {
    // The fallback is for one known missing column, not a blanket catch: a revoked grant or a typo in
    // a select has to keep failing, or the ledger starts returning quiet wrong answers.
    ledger([{ id: "j1", status: "completed" }]);
    jobsError = { message: "permission denied for table generation_jobs" };

    await expect(countGenerations("org1")).rejects.toThrow(/permission denied/);
  });
});
