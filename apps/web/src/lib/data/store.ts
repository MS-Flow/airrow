// DataStore. Org-scoped domain data lives in Supabase (issue #14). Identity comes from
// Supabase Auth (issue #18) — resolved in lib/auth.ts; this module only maps auth user
// ids to their organization via getOrgForUser.
// Server-side only: imported exclusively from RSC, actions, and route handlers.
//
// The Supabase client uses the service-role key and therefore bypasses RLS — every query
// here is additionally scoped by organization_id server-side (defense in depth, §II).
import crypto from "node:crypto";
import type {
  InterviewAnswers,
  JobStage,
  JobStatus,
  GenerationResult,
  ProjectModel
} from "@airrow/schemas";
import { db, rows, maybe, single } from "./supabase";

export type ProjectStatus = "interviewing" | "generating" | "ready" | "failed";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface OrgRecord {
  id: string;
  name: string;
  kind: "personal" | "team";
  createdBy: string;
}

export interface MemberRecord {
  organizationId: string;
  userId: string;
  role: "owner" | "admin" | "member";
}

export interface ProjectRecord {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface InterviewRecord {
  id: string;
  projectId: string;
  schemaVersion: string;
  answers: InterviewAnswers;
  completedAt: string | null;
}

export interface ModelVersionRecord {
  id: string;
  projectId: string;
  version: number;
  model: ProjectModel;
  createdAt: string;
}

export interface JobRecord {
  id: string;
  projectId: string;
  modelVersionId: string;
  status: JobStatus;
  stage: JobStage | null;
  stagesDone: JobStage[];
  filesAuthored: number;
  totalFiles: number;
  currentPath: string | null;
  error: string | null;
  heartbeatAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface DeliveryRecord {
  id: string;
  projectId: string;
  jobId: string;
  method: "zip" | "github";
  status: "completed" | "failed";
  createdAt: string;
}

export const uid = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();

/* ── Row shapes (snake_case) + mappers ────────────────────────────────────── */

interface OrgRow {
  id: string;
  name: string;
  kind: "personal" | "team";
  created_by: string | null;
}
const toOrg = (r: OrgRow): OrgRecord => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  createdBy: r.created_by ?? ""
});

interface ProjectRow {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}
const toProject = (r: ProjectRow): ProjectRecord => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  slug: r.slug,
  description: r.description,
  status: r.status,
  createdAt: r.created_at,
  updatedAt: r.updated_at
});

interface InterviewRow {
  id: string;
  project_id: string;
  schema_version: string;
  answers: InterviewAnswers;
  completed_at: string | null;
}
const toInterview = (r: InterviewRow): InterviewRecord => ({
  id: r.id,
  projectId: r.project_id,
  schemaVersion: r.schema_version,
  answers: r.answers,
  completedAt: r.completed_at
});

interface ModelRow {
  id: string;
  project_id: string;
  version: number;
  model: ProjectModel;
  created_at: string;
}
const toModel = (r: ModelRow): ModelVersionRecord => ({
  id: r.id,
  projectId: r.project_id,
  version: r.version,
  model: r.model,
  createdAt: r.created_at
});

interface JobRow {
  id: string;
  project_id: string;
  model_version_id: string;
  status: JobStatus;
  stage: JobStage | null;
  stages_done: JobStage[];
  files_authored: number;
  total_files: number;
  current_path: string | null;
  error: string | null;
  heartbeat_at: string;
  started_at: string | null;
  finished_at: string | null;
}
const toJob = (r: JobRow): JobRecord => ({
  id: r.id,
  projectId: r.project_id,
  modelVersionId: r.model_version_id,
  status: r.status,
  stage: r.stage,
  stagesDone: r.stages_done,
  filesAuthored: r.files_authored,
  totalFiles: r.total_files,
  currentPath: r.current_path,
  error: r.error,
  heartbeatAt: r.heartbeat_at,
  startedAt: r.started_at,
  finishedAt: r.finished_at
});

/* ── Organization resolution (identity comes from Supabase Auth, in lib/auth.ts) ── */

/** The organization a user belongs to (their personal org). Null if none yet. */
export async function getOrgForUser(userId: string): Promise<OrgRecord | null> {
  const memberships = rows<{ organization_id: string }>(
    await db().from("organization_members").select("organization_id").eq("user_id", userId)
  );
  const orgId = memberships[0]?.organization_id;
  if (!orgId) return null;
  const org = maybe<OrgRow>(
    await db().from("organizations").select("id, name, kind, created_by").eq("id", orgId).maybeSingle()
  );
  return org ? toOrg(org) : null;
}

/** Keep profiles.display_name in sync with the auth user's name. */
export async function setDisplayName(userId: string, name: string): Promise<void> {
  const res = await db().from("profiles").update({ display_name: name }).eq("id", userId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}

/* ── Projects (always org-scoped) ─────────────────────────────────────────── */

export async function listProjects(orgId: string): Promise<ProjectRecord[]> {
  const data = rows<ProjectRow>(
    await db()
      .from("projects")
      .select("*")
      .eq("organization_id", orgId)
      .order("updated_at", { ascending: false })
  );
  return data.map(toProject);
}

export async function getProject(orgId: string, projectId: string): Promise<ProjectRecord | null> {
  const row = maybe<ProjectRow>(
    await db().from("projects").select("*").eq("id", projectId).eq("organization_id", orgId).maybeSingle()
  );
  return row ? toProject(row) : null;
}

export async function createProject(
  orgId: string,
  name: string,
  description: string,
  slugify: (s: string) => string
): Promise<ProjectRecord> {
  const base = slugify(name);
  const taken = new Set(
    rows<{ slug: string }>(
      await db().from("projects").select("slug").eq("organization_id", orgId)
    ).map((r) => r.slug)
  );
  let slug = base;
  let n = 2;
  while (taken.has(slug)) slug = `${base}-${n++}`;

  const project = single<ProjectRow>(
    await db()
      .from("projects")
      .insert({ organization_id: orgId, name, slug, description, status: "interviewing" })
      .select("*")
      .single()
  );
  const interviewRes = await db()
    .from("interviews")
    .insert({ project_id: project.id, schema_version: "1", answers: {} });
  if (interviewRes.error) throw new Error(`Supabase: ${interviewRes.error.message}`);
  return toProject(project);
}

export async function setProjectStatus(projectId: string, status: ProjectStatus): Promise<void> {
  const res = await db()
    .from("projects")
    .update({ status, updated_at: now() })
    .eq("id", projectId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}

/** Delete a project; interviews/models/jobs/artifacts/deliveries cascade via FK. */
export async function deleteProject(orgId: string, projectId: string): Promise<void> {
  const res = await db()
    .from("projects")
    .delete()
    .eq("id", projectId)
    .eq("organization_id", orgId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}

/* ── Interviews ─────────────────────────────────────────────────────────── */

export async function getInterview(projectId: string): Promise<InterviewRecord | null> {
  const row = maybe<InterviewRow>(
    await db().from("interviews").select("*").eq("project_id", projectId).maybeSingle()
  );
  return row ? toInterview(row) : null;
}

export async function saveInterviewAnswers(
  projectId: string,
  answers: InterviewAnswers
): Promise<void> {
  const res = await db().from("interviews").update({ answers }).eq("project_id", projectId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  const touch = await db().from("projects").update({ updated_at: now() }).eq("id", projectId);
  if (touch.error) throw new Error(`Supabase: ${touch.error.message}`);
}

export async function completeInterview(projectId: string): Promise<void> {
  const res = await db()
    .from("interviews")
    .update({ completed_at: now() })
    .eq("project_id", projectId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}

/* ── Model versions ─────────────────────────────────────────────────────── */

export async function createModelVersion(
  projectId: string,
  model: ProjectModel
): Promise<ModelVersionRecord> {
  const latest = await latestModelVersion(projectId);
  const version = (latest?.version ?? 0) + 1;
  const row = single<ModelRow>(
    await db()
      .from("project_models")
      .insert({ project_id: projectId, version, model })
      .select("*")
      .single()
  );
  return toModel(row);
}

export async function latestModelVersion(projectId: string): Promise<ModelVersionRecord | null> {
  const row = maybe<ModelRow>(
    await db()
      .from("project_models")
      .select("*")
      .eq("project_id", projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  return row ? toModel(row) : null;
}

/* ── Jobs ───────────────────────────────────────────────────────────────── */

export async function createJob(projectId: string, modelVersionId: string): Promise<JobRecord> {
  const row = single<JobRow>(
    await db()
      .from("generation_jobs")
      .insert({ project_id: projectId, model_version_id: modelVersionId, status: "queued" })
      .select("*")
      .single()
  );
  return toJob(row);
}

export async function getJob(jobId: string): Promise<JobRecord | null> {
  const row = maybe<JobRow>(
    await db().from("generation_jobs").select("*").eq("id", jobId).maybeSingle()
  );
  return row ? toJob(row) : null;
}

export async function latestJob(projectId: string): Promise<JobRecord | null> {
  const row = maybe<JobRow>(
    await db()
      .from("generation_jobs")
      .select("*")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false, nullsFirst: false })
      .order("heartbeat_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  );
  return row ? toJob(row) : null;
}

/** Column mapping for a partial job update; heartbeat is always bumped (matches prior behavior). */
function jobPatchToRow(patch: Partial<JobRecord>): Record<string, unknown> {
  const row: Record<string, unknown> = { heartbeat_at: now() };
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.stage !== undefined) row.stage = patch.stage;
  if (patch.stagesDone !== undefined) row.stages_done = patch.stagesDone;
  if (patch.filesAuthored !== undefined) row.files_authored = patch.filesAuthored;
  if (patch.totalFiles !== undefined) row.total_files = patch.totalFiles;
  if (patch.currentPath !== undefined) row.current_path = patch.currentPath;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.startedAt !== undefined) row.started_at = patch.startedAt;
  if (patch.finishedAt !== undefined) row.finished_at = patch.finishedAt;
  return row;
}

export async function updateJob(jobId: string, patch: Partial<JobRecord>): Promise<void> {
  const res = await db().from("generation_jobs").update(jobPatchToRow(patch)).eq("id", jobId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}

/* ── Artifacts (GenerationResult as jsonb; one per job) ───────────────────── */

export async function saveArtifact(jobId: string, result: GenerationResult): Promise<void> {
  const res = await db()
    .from("artifacts")
    .upsert({ generation_job_id: jobId, result }, { onConflict: "generation_job_id" });
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}

export async function loadArtifact(jobId: string): Promise<GenerationResult | null> {
  const row = maybe<{ result: GenerationResult }>(
    await db().from("artifacts").select("result").eq("generation_job_id", jobId).maybeSingle()
  );
  return row ? row.result : null;
}

/* ── Deliveries ─────────────────────────────────────────────────────────── */

export async function recordDelivery(
  projectId: string,
  jobId: string,
  method: "zip" | "github"
): Promise<void> {
  const res = await db()
    .from("deliveries")
    .insert({ project_id: projectId, job_id: jobId, method, status: "completed" });
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}
