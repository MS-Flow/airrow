import { beforeEach, describe, expect, it, vi } from "vitest";

let missingPlanColumn = false;

const dbMock = vi.hoisted(() => ({
  from: vi.fn((table: string) => {
    let selection = "";
    const buildResponse = () => {
      if (table === "organization_members") {
        return { data: [{ organization_id: "org1" }], error: null };
      }

      if (table === "organizations" && selection.includes("plan")) {
        if (missingPlanColumn) {
          return {
            data: null,
            error: { message: "column organizations.plan does not exist", code: "42703" }
          };
        }

        return {
          data: {
            id: "org1",
            name: "Workspace",
            kind: "personal",
            created_by: "user1",
            plan: "pro"
          },
          error: null
        };
      }

      if (table === "organizations") {
        return {
          data: {
            id: "org1",
            name: "Workspace",
            kind: "personal",
            created_by: "user1"
          },
          error: null
        };
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
      maybeSingle: async () => {
        return buildResponse();
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

const { getOrgForUser } = await import("./store");

describe("getOrgForUser plan compatibility", () => {
  beforeEach(() => {
    missingPlanColumn = false;
    dbMock.from.mockClear();
  });

  it("reads the real plan when the column exists", async () => {
    const org = await getOrgForUser("user1");

    expect(org).toEqual({
      id: "org1",
      name: "Workspace",
      kind: "personal",
      createdBy: "user1",
      plan: "pro"
    });
  });

  it("falls back to free when the plan column is missing", async () => {
    missingPlanColumn = true;

    const org = await getOrgForUser("user1");

    expect(org).toEqual({
      id: "org1",
      name: "Workspace",
      kind: "personal",
      createdBy: "user1",
      plan: "free"
    });
  });
});