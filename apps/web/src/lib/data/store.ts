// Local-mode DataStore (ADR-0005). All persistence flows through this module —
// the Supabase implementation replaces it behind the same functions.
// Server-side only: imported exclusively from RSC, actions, and route handlers.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  InterviewAnswers,
  JobStage,
  JobStatus,
  GenerationResult,
  ProjectModel
} from "@arrow/schemas";

export type ProjectStatus = "interviewing" | "generating" | "ready" | "failed";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
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

interface Db {
  users: UserRecord[];
  sessions: SessionRecord[];
  organizations: OrgRecord[];
  members: MemberRecord[];
  projects: ProjectRecord[];
  interviews: InterviewRecord[];
  modelVersions: ModelVersionRecord[];
  jobs: JobRecord[];
  deliveries: DeliveryRecord[];
}

const EMPTY: Db = {
  users: [],
  sessions: [],
  organizations: [],
  members: [],
  projects: [],
  interviews: [],
  modelVersions: [],
  jobs: [],
  deliveries: []
};

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const DATA_DIR = process.env.ARROW_DATA_DIR ?? path.join(findRepoRoot(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const ARTIFACTS_DIR = path.join(DATA_DIR, "artifacts");

function load(): Db {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Db>) };
  } catch {
    return structuredClone(EMPTY);
  }
}

function save(db: Db): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_PATH + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DB_PATH);
}

/** Read-modify-write helper. Process-local; fine for local mode. */
function mutate<T>(fn: (db: Db) => T): T {
  const db = load();
  const out = fn(db);
  save(db);
  return out;
}

export const uid = (): string => crypto.randomUUID();
const now = (): string => new Date().toISOString();

/* ── Users / auth ───────────────────────────────────────────────────────── */

export function upsertUserByEmail(email: string, name: string): UserRecord {
  return mutate((db) => {
    const existing = db.users.find((u) => u.email === email.toLowerCase());
    if (existing) return existing;
    const user: UserRecord = { id: uid(), email: email.toLowerCase(), name, createdAt: now() };
    db.users.push(user);
    const org: OrgRecord = { id: uid(), name: `${name}'s workspace`, kind: "personal", createdBy: user.id };
    db.organizations.push(org);
    db.members.push({ organizationId: org.id, userId: user.id, role: "owner" });
    return user;
  });
}

export function updateUserName(userId: string, name: string): void {
  mutate((db) => {
    const u = db.users.find((x) => x.id === userId);
    if (u) u.name = name;
  });
}

export function createSession(userId: string): SessionRecord {
  return mutate((db) => {
    const s: SessionRecord = { token: crypto.randomBytes(24).toString("hex"), userId, createdAt: now() };
    db.sessions.push(s);
    return s;
  });
}

export function deleteSession(token: string): void {
  mutate((db) => {
    db.sessions = db.sessions.filter((s) => s.token !== token);
  });
}

export interface SessionContext {
  user: UserRecord;
  org: OrgRecord;
}

export function resolveSession(token: string): SessionContext | null {
  const db = load();
  const s = db.sessions.find((x) => x.token === token);
  if (!s) return null;
  const user = db.users.find((u) => u.id === s.userId);
  if (!user) return null;
  const membership = db.members.find((m) => m.userId === user.id);
  const org = membership
    ? db.organizations.find((o) => o.id === membership.organizationId)
    : undefined;
  if (!org) return null;
  return { user, org };
}

/* ── Projects (always org-scoped — F-205 Security) ──────────────────────── */

export function listProjects(orgId: string): ProjectRecord[] {
  return load()
    .projects.filter((p) => p.organizationId === orgId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(orgId: string, projectId: string): ProjectRecord | null {
  return load().projects.find((p) => p.id === projectId && p.organizationId === orgId) ?? null;
}

export function createProject(
  orgId: string,
  name: string,
  description: string,
  slugify: (s: string) => string
): ProjectRecord {
  return mutate((db) => {
    const base = slugify(name);
    let slug = base;
    let n = 2;
    while (db.projects.some((p) => p.organizationId === orgId && p.slug === slug)) {
      slug = `${base}-${n++}`;
    }
    const p: ProjectRecord = {
      id: uid(),
      organizationId: orgId,
      name,
      slug,
      description,
      status: "interviewing",
      createdAt: now(),
      updatedAt: now()
    };
    db.projects.push(p);
    db.interviews.push({ id: uid(), projectId: p.id, schemaVersion: "1", answers: {}, completedAt: null });
    return p;
  });
}

export function setProjectStatus(projectId: string, status: ProjectStatus): void {
  mutate((db) => {
    const p = db.projects.find((x) => x.id === projectId);
    if (p) {
      p.status = status;
      p.updatedAt = now();
    }
  });
}

export function deleteProject(orgId: string, projectId: string): void {
  mutate((db) => {
    const p = db.projects.find((x) => x.id === projectId && x.organizationId === orgId);
    if (!p) return;
    const jobIds = db.jobs.filter((j) => j.projectId === projectId).map((j) => j.id);
    db.projects = db.projects.filter((x) => x.id !== projectId);
    db.interviews = db.interviews.filter((x) => x.projectId !== projectId);
    db.modelVersions = db.modelVersions.filter((x) => x.projectId !== projectId);
    db.jobs = db.jobs.filter((x) => x.projectId !== projectId);
    db.deliveries = db.deliveries.filter((x) => x.projectId !== projectId);
    for (const id of jobIds) {
      try {
        fs.rmSync(path.join(ARTIFACTS_DIR, `${id}.json`));
      } catch {
        /* already gone */
      }
    }
  });
}

/* ── Interviews ─────────────────────────────────────────────────────────── */

export function getInterview(projectId: string): InterviewRecord | null {
  return load().interviews.find((i) => i.projectId === projectId) ?? null;
}

export function saveInterviewAnswers(projectId: string, answers: InterviewAnswers): void {
  mutate((db) => {
    const i = db.interviews.find((x) => x.projectId === projectId);
    if (i) i.answers = answers;
    const p = db.projects.find((x) => x.id === projectId);
    if (p) p.updatedAt = now();
  });
}

export function completeInterview(projectId: string): void {
  mutate((db) => {
    const i = db.interviews.find((x) => x.projectId === projectId);
    if (i) i.completedAt = now();
  });
}

/* ── Model versions ─────────────────────────────────────────────────────── */

export function createModelVersion(projectId: string, model: ProjectModel): ModelVersionRecord {
  return mutate((db) => {
    const version = db.modelVersions.filter((m) => m.projectId === projectId).length + 1;
    const rec: ModelVersionRecord = { id: uid(), projectId, version, model, createdAt: now() };
    db.modelVersions.push(rec);
    return rec;
  });
}

export function latestModelVersion(projectId: string): ModelVersionRecord | null {
  const all = load()
    .modelVersions.filter((m) => m.projectId === projectId)
    .sort((a, b) => b.version - a.version);
  return all[0] ?? null;
}

/* ── Jobs ───────────────────────────────────────────────────────────────── */

export function createJob(projectId: string, modelVersionId: string): JobRecord {
  return mutate((db) => {
    const job: JobRecord = {
      id: uid(),
      projectId,
      modelVersionId,
      status: "queued",
      stage: null,
      stagesDone: [],
      filesAuthored: 0,
      totalFiles: 0,
      currentPath: null,
      error: null,
      heartbeatAt: now(),
      startedAt: null,
      finishedAt: null
    };
    db.jobs.push(job);
    return job;
  });
}

export function getJob(jobId: string): JobRecord | null {
  return load().jobs.find((j) => j.id === jobId) ?? null;
}

export function latestJob(projectId: string): JobRecord | null {
  const all = load()
    .jobs.filter((j) => j.projectId === projectId)
    .sort((a, b) => (b.startedAt ?? b.heartbeatAt).localeCompare(a.startedAt ?? a.heartbeatAt));
  return all[0] ?? null;
}

export function updateJob(jobId: string, patch: Partial<JobRecord>): void {
  mutate((db) => {
    const j = db.jobs.find((x) => x.id === jobId);
    if (j) Object.assign(j, patch, { heartbeatAt: now() });
  });
}

/* ── Artifacts ──────────────────────────────────────────────────────────── */

export function saveArtifact(jobId: string, result: GenerationResult): void {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS_DIR, `${jobId}.json`), JSON.stringify(result), "utf8");
}

export function loadArtifact(jobId: string): GenerationResult | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(ARTIFACTS_DIR, `${jobId}.json`), "utf8")) as GenerationResult;
  } catch {
    return null;
  }
}

/* ── Deliveries ─────────────────────────────────────────────────────────── */

export function recordDelivery(projectId: string, jobId: string, method: "zip" | "github"): void {
  mutate((db) => {
    db.deliveries.push({ id: uid(), projectId, jobId, method, status: "completed", createdAt: now() });
  });
}
