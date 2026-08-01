// The operator's reads (spec 150).
//
// **This is the one module in the codebase that deliberately crosses the tenancy boundary.** Every
// other read in `lib/data` scopes by `organization_id` because §II says a resource belongs to an
// organization; these read across all of them, because running Airrow means answering questions about
// people who are not us.
//
// That is why it is one file rather than a set of special cases in `store.ts`: the place where the
// rule is suspended should be a file a reviewer can read end to end, not a flag threaded through the
// module everything else already uses.
//
// **Every exported function takes the actor's id and passes it through `assertAdmin` before it reads
// anything.** That is not belt-and-braces on top of the page gate — it is the check that actually
// matters. The pages call `requireAdmin()`, the actions call it again, and this layer refuses on its
// own, so no future caller can reach across organizations by forgetting a gate somewhere above.
//
// Server-side only. The client here uses the service-role key and therefore bypasses RLS, which is
// exactly why the `is_admin` check has to be explicit rather than delegated to Postgres.
import { db, rows, rowsOrAbsent } from "./supabase";
import { profileFlags, type ProjectStatus } from "./store";
import { creditsAvailableFor } from "./credits";

/** How many rows one page of any admin list shows. */
export const ADMIN_PAGE_SIZE = 25;

/**
 * Refuse anyone who is not an operator.
 *
 * Throws rather than returning a result: every caller below is about to read other people's data, and
 * there is no sensible partial answer to give someone who may not have it. A thrown error here is a
 * bug in the caller — the UI never reaches this without `requireAdmin()` having passed.
 */
async function assertAdmin(actorId: string): Promise<void> {
  const { isAdmin } = await profileFlags(actorId);
  if (!isAdmin) throw new Error("admin: refused — this account does not operate Airrow.");
}

/** One page of a list, plus what the pager needs to know. */
export interface Page<T> {
  items: T[];
  /**
   * Whether another page exists — decided here, where the extra row was fetched, and never re-derived
   * downstream. A pager that infers it from `items.length === pageSize` is wrong the moment anything
   * removes a row from a page, and wrong in the direction that hides the rest of the list.
   */
  hasMore: boolean;
  page: number;
  pageSize: number;
}

/**
 * Ask for one more row than fits.
 *
 * Postgres range queries are half-open and PostgREST returns an exact count only when asked for one,
 * which costs a second scan. Fetching `size + 1` answers "is there a next page" for free.
 */
function range(page: number, size: number): [number, number] {
  const from = Math.max(0, page) * size;
  return [from, from + size];
}

function toPage<T>(found: T[], page: number, size: number): Page<T> {
  const hasMore = found.length > size;
  return { items: hasMore ? found.slice(0, size) : found, hasMore, page, pageSize: size };
}

/* ── Users ──────────────────────────────────────────────────────────────── */

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  lastSignInAt: string | null;
  verified: boolean;
  suspendedAt: string | null;
  isAdmin: boolean;
  orgId: string | null;
  orgName: string | null;
  plan: string;
  /** True when an earned week (spec 122) currently covers the workspace. */
  grantActive: boolean;
  creditsAvailable: number;
  projects: number;
  generations: number;
  lastGenerationAt: string | null;
  /** The workspace that invited them, if they arrived through a link (spec 122). */
  invitedBy: string | null;
  subscriptionStatus: string | null;
}

interface AccountRow {
  id: string;
  email: string | null;
  display_name: string | null;
  is_admin: boolean;
  suspended_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

/** What the user list can be ordered by, and the column each one means. */
export const USER_SORTS = {
  signup: "created_at",
  activity: "last_sign_in_at"
} as const;

export type UserSort = keyof typeof USER_SORTS;

/**
 * One page of accounts, with everything the console shows about each.
 *
 * Paginated and searched **in Postgres** — the list is the screen support lives on, and a version that
 * fetched every profile to filter in JavaScript would work right up until it mattered. The per-page
 * detail is then gathered with a fixed number of batched queries keyed on the ids of that page, so the
 * cost is flat in the number of users rather than one query per row.
 */
export async function adminUsers(
  actorId: string,
  options: { search?: string; page?: number; sort?: UserSort; ascending?: boolean } = {}
): Promise<Page<AdminUser>> {
  await assertAdmin(actorId);
  const page = options.page ?? 0;
  const [from, to] = range(page, ADMIN_PAGE_SIZE);
  const search = options.search?.trim();
  const sort = options.sort ?? "signup";

  // `admin_accounts` rather than `profiles`: sorting by last activity means ordering on a column that
  // lives in `auth.users`, and ordering a page after it has been fetched sorts twenty-five rows rather
  // than the list. The view joins them so search, sort and paging are one query (§II — the aggregate
  // belongs in Postgres).
  let query = db()
    .from("admin_accounts")
    .select("id, email, display_name, is_admin, suspended_at, created_at, last_sign_in_at, email_confirmed_at")
    .order(USER_SORTS[sort], {
      ascending: options.ascending ?? false,
      // An account that has never signed in has no last activity. Sorted descending it belongs at the
      // end, not ahead of everyone who has — nulls are "never", not "most recent".
      nullsFirst: false
    })
    .range(from, to);
  if (search) {
    // Both columns, because support is handed either a name or an address and should not have to know
    // which. `%` and `,` are stripped: PostgREST parses `or` as a comma-separated filter list, so an
    // unescaped comma in a search box would be read as another filter rather than as text.
    const term = search.replace(/[%,()]/g, "");
    query = query.or(`email.ilike.%${term}%,display_name.ilike.%${term}%`);
  }

  const accounts = rows<AccountRow>(await query);
  const shown = toPage(accounts, page, ADMIN_PAGE_SIZE);
  const userIds = shown.items.map((p) => p.id);
  if (userIds.length === 0) return { ...shown, items: [] };

  const memberships = rows<{ organization_id: string; user_id: string }>(
    await db().from("organization_members").select("organization_id, user_id").in("user_id", userIds)
  );
  const orgByUser = new Map(memberships.map((m) => [m.user_id, m.organization_id]));
  const orgIds = [...new Set(memberships.map((m) => m.organization_id))];

  const [orgs, projects, usage, credits, grants, invites, subs] = await Promise.all([
    rows<{ id: string; name: string; plan: string | null }>(
      await db().from("organizations").select("id, name, plan").in("id", orgIds)
    ),
    rows<{ organization_id: string }>(
      await db().from("projects").select("organization_id").in("organization_id", orgIds)
    ),
    rows<{ organization_id: string; created_at: string }>(
      await db().from("generation_usage").select("organization_id, created_at").in("organization_id", orgIds)
    ),
    creditsAvailableFor(orgIds),
    rowsOrAbsent<{ organization_id: string; starts_at: string | null; expires_at: string | null }>(
      await db().from("plan_grants").select("organization_id, starts_at, expires_at").in("organization_id", orgIds)
    ),
    rowsOrAbsent<{ referred_organization_id: string; referrer_organization_id: string }>(
      await db()
        .from("referrals")
        .select("referred_organization_id, referrer_organization_id")
        .in("referred_organization_id", orgIds)
    ),
    rowsOrAbsent<{ organization_id: string; status: string }>(
      await db().from("subscriptions").select("organization_id, status").in("organization_id", orgIds)
    )
  ]);

  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const projectCounts = tally(projects.map((p) => p.organization_id));
  const generationCounts = tally(usage.map((u) => u.organization_id));
  const lastGeneration = new Map<string, string>();
  for (const row of usage) {
    const current = lastGeneration.get(row.organization_id);
    if (!current || row.created_at > current) lastGeneration.set(row.organization_id, row.created_at);
  }
  const now = Date.now();
  const activeGrants = new Set(
    (grants ?? [])
      .filter(
        (g) =>
          g.starts_at !== null &&
          g.expires_at !== null &&
          Date.parse(g.starts_at) <= now &&
          now < Date.parse(g.expires_at)
      )
      .map((g) => g.organization_id)
  );
  const inviterByOrg = new Map(
    (invites ?? []).map((r) => [r.referred_organization_id, r.referrer_organization_id])
  );
  const subByOrg = new Map((subs ?? []).map((s) => [s.organization_id, s.status]));

  // Inviter workspaces are usually outside this page's orgs, so they are named in their own query.
  const inviterIds = [...new Set([...inviterByOrg.values()])];
  const inviterNames = new Map(
    (inviterIds.length === 0
      ? []
      : rows<{ id: string; name: string }>(
          await db().from("organizations").select("id, name").in("id", inviterIds)
        )
    ).map((o) => [o.id, o.name])
  );

  const items = shown.items.map((account): AdminUser => {
    const orgId = orgByUser.get(account.id) ?? null;
    const org = orgId ? orgById.get(orgId) : undefined;
    const inviter = orgId ? inviterByOrg.get(orgId) : undefined;
    return {
      id: account.id,
      email: account.email ?? "",
      name: account.display_name ?? account.email ?? "",
      createdAt: account.created_at,
      lastSignInAt: account.last_sign_in_at,
      verified: Boolean(account.email_confirmed_at),
      suspendedAt: account.suspended_at,
      isAdmin: account.is_admin,
      orgId,
      orgName: org?.name ?? null,
      plan: org?.plan ?? "free",
      grantActive: orgId ? activeGrants.has(orgId) : false,
      creditsAvailable: (orgId ? credits.get(orgId) : 0) ?? 0,
      projects: (orgId ? projectCounts.get(orgId) : 0) ?? 0,
      generations: (orgId ? generationCounts.get(orgId) : 0) ?? 0,
      lastGenerationAt: (orgId ? lastGeneration.get(orgId) : null) ?? null,
      invitedBy: inviter ? (inviterNames.get(inviter) ?? null) : null,
      subscriptionStatus: (orgId ? subByOrg.get(orgId) : null) ?? null
    };
  });

  return { ...shown, items };
}

function tally(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/* ── Audit ──────────────────────────────────────────────────────────────── */

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  subjectType: string;
  subjectId: string;
  reason: string;
  createdAt: string;
}

interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  subject_type: string;
  subject_id: string;
  reason: string;
  created_at: string;
}

/**
 * What has been done to these subjects, newest first.
 *
 * Takes a list rather than one id so a whole page of users costs one query. This is the read that
 * makes the audit log an audit log: a record only we can write and only we can see is a diary, and the
 * point of writing it down was to be able to look.
 */
export async function adminAudit(
  actorId: string,
  subjects: { type: string; ids: string[] }
): Promise<Map<string, AuditEntry[]>> {
  await assertAdmin(actorId);
  const bySubject = new Map<string, AuditEntry[]>();
  if (subjects.ids.length === 0) return bySubject;

  const found =
    rowsOrAbsent<AuditRow>(
      await db()
        .from("admin_audit_log")
        .select("id, actor_id, action, subject_type, subject_id, reason, created_at")
        .eq("subject_type", subjects.type)
        .in("subject_id", subjects.ids)
        .order("created_at", { ascending: false })
    ) ?? [];

  const actorIds = [...new Set(found.map((r) => r.actor_id).filter((id): id is string => id !== null))];
  const actors = new Map(
    (actorIds.length === 0
      ? []
      : rows<{ id: string; display_name: string | null }>(
          await db().from("profiles").select("id, display_name").in("id", actorIds)
        )
    ).map((p) => [p.id, p.display_name])
  );

  for (const row of found) {
    const entry: AuditEntry = {
      id: row.id,
      actorId: row.actor_id,
      actorName: row.actor_id ? (actors.get(row.actor_id) ?? null) : null,
      action: row.action,
      subjectType: row.subject_type,
      subjectId: row.subject_id,
      reason: row.reason,
      createdAt: row.created_at
    };
    const list = bySubject.get(row.subject_id);
    if (list) list.push(entry);
    else bySubject.set(row.subject_id, [entry]);
  }
  return bySubject;
}

/** Record an operator action. Called by the actions, never by a screen. */
export async function recordAdminAction(input: {
  actorId: string;
  action:
    | "user.suspend"
    | "user.reactivate"
    | "credits.grant"
    | "ticket.close"
    | "ticket.reopen"
    | "review.publish"
    | "review.unpublish";
  subjectType: "user" | "organization" | "ticket" | "review";
  subjectId: string;
  reason?: string;
}): Promise<void> {
  await assertAdmin(input.actorId);
  const res = await db().from("admin_audit_log").insert({
    actor_id: input.actorId,
    action: input.action,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    reason: input.reason ?? ""
  });
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}

/* ── Projects ───────────────────────────────────────────────────────────── */

export interface AdminProject {
  id: string;
  name: string;
  status: ProjectStatus;
  orgId: string;
  orgName: string | null;
  createdAt: string;
  updatedAt: string;
  generations: number;
  /** `zip` / `repo` when the founder brought an existing codebase, null when they started from scratch. */
  importKind: "zip" | "repo" | null;
}

export async function adminProjects(
  actorId: string,
  options: { status?: ProjectStatus; origin?: "imported" | "scratch"; page?: number } = {}
): Promise<Page<AdminProject>> {
  await assertAdmin(actorId);
  const page = options.page ?? 0;
  const [from, to] = range(page, ADMIN_PAGE_SIZE);

  // Origin is decided **in the query**, through an embedded resource. `!inner` keeps only projects
  // that have an import source; the plain embed plus `is null` keeps only those that do not. Doing it
  // any later would filter rows out of a page the database had already sized, so a page could come
  // back short and be indistinguishable from the end of the list.
  const embed = options.origin === "imported" ? "import_sources!inner(kind)" : "import_sources(kind)";
  let query = db()
    .from("projects")
    .select(`id, name, status, organization_id, created_at, updated_at, ${embed}`)
    .order("updated_at", { ascending: false })
    .range(from, to);
  if (options.status) query = query.eq("status", options.status);
  if (options.origin === "scratch") query = query.is("import_sources", null);

  const found = rows<{
    id: string;
    name: string;
    status: ProjectStatus;
    organization_id: string;
    created_at: string;
    updated_at: string;
    import_sources: { kind: "zip" | "repo" }[];
  }>(await query);
  const shown = toPage(found, page, ADMIN_PAGE_SIZE);
  const projectIds = shown.items.map((p) => p.id);
  if (projectIds.length === 0) return { ...shown, items: [] };

  const orgIds = [...new Set(shown.items.map((p) => p.organization_id))];
  const [orgs, usage] = await Promise.all([
    rows<{ id: string; name: string }>(
      await db().from("organizations").select("id, name").in("id", orgIds)
    ),
    rows<{ project_id: string | null }>(
      await db().from("generation_usage").select("project_id").in("project_id", projectIds)
    )
  ]);
  const orgById = new Map(orgs.map((o) => [o.id, o.name]));
  const generationCounts = tally(usage.map((u) => u.project_id).filter((id): id is string => id !== null));

  return {
    ...shown,
    items: shown.items.map((project): AdminProject => ({
      id: project.id,
      name: project.name,
      status: project.status,
      orgId: project.organization_id,
      orgName: orgById.get(project.organization_id) ?? null,
      createdAt: project.created_at,
      updatedAt: project.updated_at,
      generations: generationCounts.get(project.id) ?? 0,
      // The embed is a one-to-many, so an array; a project has at most one import source.
      importKind: project.import_sources[0]?.kind ?? null
    }))
  };
}

export interface AdminProjectDetail extends AdminProject {
  description: string;
  /** The interview, question by question, as the founder answered it. */
  answers: { id: string; question: string; answer: string }[];
  interviewCompletedAt: string | null;
  job: {
    id: string;
    status: string;
    stage: string | null;
    stagesDone: string[];
    error: string | null;
    /** Non-null means the authoring layer refused the answers (spec 128) — not our failure. */
    rejectedAnswers: string[] | null;
    startedAt: string | null;
    finishedAt: string | null;
  } | null;
}

/**
 * One project in full, including the interview rendered readably.
 *
 * The answers are customer IP (§II). They are shown here because supporting a founder whose generation
 * went wrong is impossible without seeing what it was given — and for the same reason, nothing on this
 * path is ever logged. The privacy policy says so in the same change that added this screen.
 */
export async function adminProject(
  actorId: string,
  projectId: string,
  renderAnswers: (answers: unknown) => { id: string; question: string; answer: string }[]
): Promise<AdminProjectDetail | null> {
  await assertAdmin(actorId);

  const project = rows<{
    id: string;
    name: string;
    description: string;
    status: ProjectStatus;
    organization_id: string;
    created_at: string;
    updated_at: string;
  }>(
    await db()
      .from("projects")
      .select("id, name, description, status, organization_id, created_at, updated_at")
      .eq("id", projectId)
  )[0];
  if (!project) return null;

  const [orgs, interviews, jobs, imports, usage] = await Promise.all([
    rows<{ id: string; name: string }>(
      await db().from("organizations").select("id, name").eq("id", project.organization_id)
    ),
    rows<{ answers: unknown; completed_at: string | null }>(
      await db().from("interviews").select("answers, completed_at").eq("project_id", projectId)
    ),
    rows<{
      id: string;
      status: string;
      stage: string | null;
      stages_done: string[];
      error: string | null;
      rejected_answers: string[] | null;
      started_at: string | null;
      finished_at: string | null;
    }>(
      await db()
        .from("generation_jobs")
        .select("id, status, stage, stages_done, error, rejected_answers, started_at, finished_at")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false, nullsFirst: false })
        .limit(1)
    ),
    rows<{ kind: "zip" | "repo" }>(
      await db().from("import_sources").select("kind").eq("project_id", projectId)
    ),
    rows<{ id: string }>(
      await db().from("generation_usage").select("id").eq("project_id", projectId)
    )
  ]);

  const interview = interviews[0];
  const job = jobs[0];

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    orgId: project.organization_id,
    orgName: orgs[0]?.name ?? null,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    generations: usage.length,
    importKind: imports[0]?.kind ?? null,
    answers: interview ? renderAnswers(interview.answers) : [],
    interviewCompletedAt: interview?.completed_at ?? null,
    job: job
      ? {
          id: job.id,
          status: job.status,
          stage: job.stage,
          stagesDone: job.stages_done ?? [],
          error: job.error,
          rejectedAnswers: job.rejected_answers,
          startedAt: job.started_at,
          finishedAt: job.finished_at
        }
      : null
  };
}

/* ── Tickets ────────────────────────────────────────────────────────────── */

export interface AdminTicket {
  id: string;
  category: string;
  subject: string;
  body: string;
  status: "open" | "closed";
  createdAt: string;
  orgId: string;
  orgName: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  projectId: string | null;
  projectName: string | null;
}

export async function adminTickets(
  actorId: string,
  options: { status?: "open" | "closed"; category?: string; page?: number } = {}
): Promise<Page<AdminTicket>> {
  await assertAdmin(actorId);
  const page = options.page ?? 0;
  const [from, to] = range(page, ADMIN_PAGE_SIZE);

  let query = db()
    .from("support_tickets")
    .select("id, organization_id, user_id, project_id, category, subject, body, status, created_at")
    .order("created_at", { ascending: false })
    .range(from, to);
  if (options.status) query = query.eq("status", options.status);
  if (options.category) query = query.eq("category", options.category);

  const found =
    rowsOrAbsent<{
      id: string;
      organization_id: string;
      user_id: string;
      project_id: string | null;
      category: string;
      subject: string;
      body: string;
      status: "open" | "closed";
      created_at: string;
    }>(await query) ?? [];
  const shown = toPage(found, page, ADMIN_PAGE_SIZE);
  if (shown.items.length === 0) return { ...shown, items: [] };

  const orgIds = [...new Set(shown.items.map((t) => t.organization_id))];
  const userIds = [...new Set(shown.items.map((t) => t.user_id))];
  const projectIds = shown.items.map((t) => t.project_id).filter((id): id is string => id !== null);

  const [orgs, profiles, projects] = await Promise.all([
    rows<{ id: string; name: string }>(
      await db().from("organizations").select("id, name").in("id", orgIds)
    ),
    rows<{ id: string; display_name: string | null; email: string | null }>(
      await db().from("profiles").select("id, display_name, email").in("id", userIds)
    ),
    projectIds.length === 0
      ? []
      : rows<{ id: string; name: string }>(
          await db().from("projects").select("id, name").in("id", projectIds)
        )
  ]);
  const orgById = new Map(orgs.map((o) => [o.id, o.name]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const projectById = new Map(projects.map((p) => [p.id, p.name]));

  return {
    ...shown,
    items: shown.items.map((ticket): AdminTicket => {
      const profile = profileById.get(ticket.user_id);
      return {
        id: ticket.id,
        category: ticket.category,
        subject: ticket.subject,
        body: ticket.body,
        status: ticket.status,
        createdAt: ticket.created_at,
        orgId: ticket.organization_id,
        orgName: orgById.get(ticket.organization_id) ?? null,
        userId: ticket.user_id,
        userName: profile?.display_name ?? null,
        userEmail: profile?.email ?? null,
        projectId: ticket.project_id,
        projectName: ticket.project_id ? (projectById.get(ticket.project_id) ?? null) : null
      };
    })
  };
}

/** Set a ticket open or closed. The column has existed since spec 144 with nothing able to change it. */
export async function setTicketStatus(
  actorId: string,
  ticketId: string,
  status: "open" | "closed"
): Promise<void> {
  await assertAdmin(actorId);
  const res = await db().from("support_tickets").update({ status }).eq("id", ticketId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
}

/* ── Reviews ────────────────────────────────────────────────────────────── */

export interface AdminReview {
  id: string;
  rating: number;
  body: string;
  displayName: string;
  consentPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
  projectId: string;
  projectName: string | null;
  orgId: string;
  orgName: string | null;
}

export async function adminReviews(
  actorId: string,
  options: { rating?: number; pending?: boolean; page?: number } = {}
): Promise<Page<AdminReview>> {
  await assertAdmin(actorId);
  const page = options.page ?? 0;
  const [from, to] = range(page, ADMIN_PAGE_SIZE);

  let query = db()
    .from("project_reviews")
    .select(
      "id, organization_id, project_id, rating, body, display_name, consent_public, published_at, created_at"
    )
    .order("created_at", { ascending: false })
    .range(from, to);
  if (options.rating) query = query.eq("rating", options.rating);
  // "Awaiting decision" is what makes this a queue rather than an archive: consented, not yet ours.
  if (options.pending) query = query.eq("consent_public", true).is("published_at", null);

  const found =
    rowsOrAbsent<{
      id: string;
      organization_id: string;
      project_id: string;
      rating: number;
      body: string;
      display_name: string;
      consent_public: boolean;
      published_at: string | null;
      created_at: string;
    }>(await query) ?? [];
  const shown = toPage(found, page, ADMIN_PAGE_SIZE);
  if (shown.items.length === 0) return { ...shown, items: [] };

  const [orgs, projects] = await Promise.all([
    rows<{ id: string; name: string }>(
      await db()
        .from("organizations")
        .select("id, name")
        .in("id", [...new Set(shown.items.map((r) => r.organization_id))])
    ),
    rows<{ id: string; name: string }>(
      await db()
        .from("projects")
        .select("id, name")
        .in("id", shown.items.map((r) => r.project_id))
    )
  ]);
  const orgById = new Map(orgs.map((o) => [o.id, o.name]));
  const projectById = new Map(projects.map((p) => [p.id, p.name]));

  return {
    ...shown,
    items: shown.items.map((review): AdminReview => ({
      id: review.id,
      rating: review.rating,
      body: review.body,
      displayName: review.display_name,
      consentPublic: review.consent_public,
      publishedAt: review.published_at,
      createdAt: review.created_at,
      projectId: review.project_id,
      projectName: projectById.get(review.project_id) ?? null,
      orgId: review.organization_id,
      orgName: orgById.get(review.organization_id) ?? null
    }))
  };
}

/**
 * Publish or unpublish a review — the only thing in the codebase that ever *sets* `published_at`,
 * exactly as spec 144 promised.
 *
 * **A review without `consent_public` cannot be published, and the refusal lives here** rather than in
 * the action or the form. Consent is the founder's permission and publication is ours; both are
 * required, and the check belongs at the layer that does the writing, where no caller can skip it by
 * posting straight to the server.
 *
 * The unpublish direction has no such condition: taking something down is always allowed.
 */
export async function setReviewPublished(
  actorId: string,
  reviewId: string,
  published: boolean,
  now: Date = new Date()
): Promise<{ ok: true } | { ok: false; reason: "no-consent" | "missing" }> {
  await assertAdmin(actorId);

  const review = rows<{ id: string; consent_public: boolean }>(
    await db().from("project_reviews").select("id, consent_public").eq("id", reviewId)
  )[0];
  if (!review) return { ok: false, reason: "missing" };
  if (published && !review.consent_public) return { ok: false, reason: "no-consent" };

  const res = await db()
    .from("project_reviews")
    .update({ published_at: published ? now.toISOString() : null })
    .eq("id", reviewId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return { ok: true };
}

/* ── Suspension ─────────────────────────────────────────────────────────── */

/**
 * Take an account offline, or bring it back.
 *
 * Two writes, both required. `profiles.suspended_at` is what `getSession` reads, so the session the
 * founder is holding stops working at their next server call; the Supabase Auth ban is what stops them
 * fetching a new one. Doing only the first leaves a cosmetic suspension that lasts until the token
 * expires; doing only the second leaves an open session working for its remaining lifetime.
 *
 * Nothing is deleted, and the whole thing is reversible — which is exactly why this is the operator
 * action that exists and account deletion is not (spec 150, _Out of scope_).
 */
export async function setUserSuspended(
  actorId: string,
  userId: string,
  suspended: boolean,
  now: Date = new Date()
): Promise<void> {
  await assertAdmin(actorId);

  const res = await db()
    .from("profiles")
    .update({ suspended_at: suspended ? now.toISOString() : null })
    .eq("id", userId);
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);

  // `none` rather than `0` clears an existing ban — Supabase's admin API spells "not banned" as a
  // zero-length duration.
  const ban = await db().auth.admin.updateUserById(userId, {
    ban_duration: suspended ? "876000h" : "none"
  });
  if (ban.error) throw new Error(`Supabase Auth: ${ban.error.message}`);
}

/* ── Statistics ─────────────────────────────────────────────────────────── */

export interface AdminTotals {
  signups: number;
  projects: number;
  interviewsCompleted: number;
  generations: number;
  failuresOurs: number;
  failuresRejected: number;
  tickets: number;
  invitesCreated: number;
  invitesMatured: number;
  grantWeeks: number;
  reviews: number;
  avgRating: number | null;
}

export interface AdminStats {
  /** One point per day, zeros included, so the curve has no holes. */
  series: { day: string; signups: number; projects: number; generations: number; tickets: number }[];
  current: AdminTotals;
  /** The same window, immediately before. A number without a direction is not information. */
  previous: AdminTotals;
  projectStatus: { status: string; total: number }[];
  interviewProgress: { answered: number; total: number }[];
  ticketCategories: { category: string; total: number }[];
  reviewDistribution: { rating: number; total: number }[];
  standing: {
    proOrgs: number;
    freeOrgs: number;
    subsActive: number;
    subsCancelling: number;
    grantsActive: number;
    creditsUnspent: number;
    ticketsOpen: number;
    reviewsConsented: number;
    reviewsPublished: number;
  };
}

interface TotalsRow {
  signups: number;
  projects: number;
  interviews_completed: number;
  generations: number;
  failures_ours: number;
  failures_rejected: number;
  tickets: number;
  invites_created: number;
  invites_matured: number;
  grant_weeks: number;
  reviews: number;
  avg_rating: string | number | null;
}

const toTotals = (r: TotalsRow | undefined): AdminTotals => ({
  signups: Number(r?.signups ?? 0),
  projects: Number(r?.projects ?? 0),
  interviewsCompleted: Number(r?.interviews_completed ?? 0),
  generations: Number(r?.generations ?? 0),
  failuresOurs: Number(r?.failures_ours ?? 0),
  failuresRejected: Number(r?.failures_rejected ?? 0),
  tickets: Number(r?.tickets ?? 0),
  invitesCreated: Number(r?.invites_created ?? 0),
  invitesMatured: Number(r?.invites_matured ?? 0),
  grantWeeks: Number(r?.grant_weeks ?? 0),
  reviews: Number(r?.reviews ?? 0),
  avgRating: r?.avg_rating === null || r?.avg_rating === undefined ? null : Number(r.avg_rating)
});

/**
 * Every number on the statistics screen, computed in Postgres.
 *
 * Nine round trips, none of which returns more than a handful of rows — against a version that read
 * every project, interview and job into Node to count them. That is the difference between a page that
 * keeps working as we grow and one that stops working exactly when the numbers become interesting.
 */
export async function adminStats(
  actorId: string,
  options: { days?: number; now?: Date } = {}
): Promise<AdminStats> {
  await assertAdmin(actorId);
  const days = options.days ?? 30;
  const now = options.now ?? new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const from = new Date(now.getTime() - days * dayMs);
  const previousFrom = new Date(from.getTime() - days * dayMs);
  const isoDay = (d: Date): string => d.toISOString().slice(0, 10);

  const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T[]> => {
    const res = await db().rpc(fn, args);
    if (res.error) throw new Error(`Supabase: ${res.error.message}`);
    // `as` justified: each function's row shape is fixed by the migration that declares it, and the
    // client types an RPC payload as `unknown`.
    return (res.data ?? []) as T[];
  };

  const [series, current, previous, projectStatus, interviewProgress, categories, distribution, standing] =
    await Promise.all([
      call<{ day: string; signups: number; projects: number; generations: number; tickets: number }>(
        "admin_daily_series",
        { p_from: isoDay(from), p_to: isoDay(now) }
      ),
      call<TotalsRow>("admin_totals", { p_from: from.toISOString(), p_to: now.toISOString() }),
      call<TotalsRow>("admin_totals", {
        p_from: previousFrom.toISOString(),
        p_to: from.toISOString()
      }),
      call<{ status: string; total: number }>("admin_project_status_counts", {}),
      call<{ answered: number; total: number }>("admin_interview_progress", {}),
      call<{ category: string; total: number }>("admin_ticket_categories", {
        p_from: from.toISOString(),
        p_to: now.toISOString()
      }),
      call<{ rating: number; total: number }>("admin_review_distribution", {}),
      call<{
        pro_orgs: number;
        free_orgs: number;
        subs_active: number;
        subs_cancelling: number;
        grants_active: number;
        credits_unspent: number;
        tickets_open: number;
        reviews_consented: number;
        reviews_published: number;
      }>("admin_standing", {})
    ]);

  const s = standing[0];
  return {
    series: series.map((row) => ({
      day: row.day,
      signups: Number(row.signups),
      projects: Number(row.projects),
      generations: Number(row.generations),
      tickets: Number(row.tickets)
    })),
    current: toTotals(current[0]),
    previous: toTotals(previous[0]),
    projectStatus: projectStatus.map((r) => ({ status: r.status, total: Number(r.total) })),
    interviewProgress: interviewProgress.map((r) => ({
      answered: Number(r.answered),
      total: Number(r.total)
    })),
    ticketCategories: categories.map((r) => ({ category: r.category, total: Number(r.total) })),
    reviewDistribution: distribution.map((r) => ({ rating: Number(r.rating), total: Number(r.total) })),
    standing: {
      proOrgs: Number(s?.pro_orgs ?? 0),
      freeOrgs: Number(s?.free_orgs ?? 0),
      subsActive: Number(s?.subs_active ?? 0),
      subsCancelling: Number(s?.subs_cancelling ?? 0),
      grantsActive: Number(s?.grants_active ?? 0),
      creditsUnspent: Number(s?.credits_unspent ?? 0),
      ticketsOpen: Number(s?.tickets_open ?? 0),
      reviewsConsented: Number(s?.reviews_consented ?? 0),
      reviewsPublished: Number(s?.reviews_published ?? 0)
    }
  };
}
