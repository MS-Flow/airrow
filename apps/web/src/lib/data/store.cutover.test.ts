// DataStore cutover integration test (issue #14): drives the real store.ts against local
// Supabase over the REST API (service-role), proving create → read-back per resource and
// cross-org denial via server-side org scoping. Skipped when local Supabase is unreachable.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "pg";
import type { GenerationResult, ProjectModel } from "@airrow/schemas";

// Point the store at local Supabase before it reads these (db() is lazy). The local
// service-role key is a fixed default tied to the local JWT secret — same on every install.
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY ??=
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const ORG = "00000000-0000-0000-0000-0000000000c1";
const ORG_OTHER = "00000000-0000-0000-0000-0000000000c2";
const USER = "00000000-0000-0000-0000-0000000000c3";

const slugify = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

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

// Import the store only after env is set above.
const store = await import("./store");

describe.skipIf(!dbUp)("DataStore cutover (local Supabase)", () => {
  const db = new Client({ connectionString: DB_URL });

  beforeAll(async () => {
    await db.connect();
    await cleanup();
    await db.query("insert into public.organizations (id, name) values ($1,'Cutover'),($2,'Other')", [ORG, ORG_OTHER]);
    await db.query("insert into public.organization_members (organization_id, user_id) values ($1,$2)", [ORG, USER]);
  });

  afterAll(async () => {
    await cleanup();
    await db.end();
  });

  async function cleanup(): Promise<void> {
    await db.query("delete from public.organizations where id = any($1)", [[ORG, ORG_OTHER]]);
  }

  it("creates a project (with its interview) and reads it back, scoped to the org", async () => {
    const project = await store.createProject(ORG, "My Cutover App", "desc", slugify);
    expect(project.organizationId).toBe(ORG);

    const list = await store.listProjects(ORG);
    expect(list.map((p) => p.id)).toContain(project.id);

    const got = await store.getProject(ORG, project.id);
    expect(got?.id).toBe(project.id);

    // createProject seeds one interview per project.
    const interview = await store.getInterview(project.id);
    expect(interview?.projectId).toBe(project.id);

    // Cross-org denial: another org cannot read this project.
    expect(await store.getProject(ORG_OTHER, project.id)).toBeNull();
  });

  it("round-trips a model version, job, and artifact", async () => {
    const project = await store.createProject(ORG, "Roundtrip", "d", slugify);
    const model = await store.createModelVersion(project.id, {} as unknown as ProjectModel);
    expect(model.version).toBe(1);

    const job = await store.createJob(project.id, model.id);
    expect(job.status).toBe("queued");
    await store.updateJob(job.id, { status: "running", stagesDone: ["resolve"] });
    const running = await store.getJob(job.id);
    expect(running?.status).toBe("running");
    expect(running?.stagesDone).toEqual(["resolve"]);

    const result = { files: [], manifest: {} } as unknown as GenerationResult;
    await store.saveArtifact(job.id, result);
    expect(await store.loadArtifact(job.id)).toEqual(result);
  });

  it("updates status and deletes a project (cascading its children)", async () => {
    const project = await store.createProject(ORG, "Deletable", "d", slugify);
    await store.setProjectStatus(project.id, "ready");
    expect((await store.getProject(ORG, project.id))?.status).toBe("ready");

    await store.deleteProject(ORG, project.id);
    expect(await store.getProject(ORG, project.id)).toBeNull();
    expect(await store.getInterview(project.id)).toBeNull();
  });
});
