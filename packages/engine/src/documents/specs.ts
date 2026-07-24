// Generated feature specifications — one per selected capability.
// The strongest personalization surface: real FRs/ACs per feature, per model.

import type { FeatureId, GeneratedFile, ProjectModel } from "../../../schemas/src/types.ts";
import { authSummary, featureLabel, isSpaFramework, usesSupabase } from "../model.ts";

const authored = (path: string, templateId: string, content: string): GeneratedFile => ({
  path,
  templateId,
  source: "authored",
  content: content.trimStart()
});

export function specsReadme(m: ProjectModel): GeneratedFile {
  return authored(
    "specs/README.md",
    "specs/readme",
    `
# Specification System

Specifications are the source of truth in ${m.name}. Code implements specs; docs explain specs; review reviews against specs.

## Rules

1. No feature is implemented before its spec is complete (\`templates/SPEC_TEMPLATE.md\`).
2. Reality diverging from spec → update the spec first, then the code.
3. Empty sections aren't allowed — fill or justify "N/A".
4. Superseded specs are marked and linked, never deleted.

## Included starter specs

Airrow generated a starter spec for each capability you selected (\`specs/mvp/\`). They are drafts with real requirements — review, adjust to your product, and mark Ready before implementing. They encode best-practice FRs, security notes, and edge cases so you and your AI assistant start from substance, not a blank page.
`
  );
}

interface SpecDef {
  problem: (m: ProjectModel) => string;
  frs: (m: ProjectModel) => string[];
  acs: (m: ProjectModel) => string[];
  security: (m: ProjectModel) => string;
  edges: (m: ProjectModel) => string;
  arch: (m: ProjectModel) => string;
}

const t = (mt: boolean, yes: string, no: string) => (mt ? yes : no);

const specDefs: Partial<Record<FeatureId, SpecDef>> = {
  auth: {
    problem: () => "Users need secure, low-friction identity before any personalized functionality can exist.",
    frs: (m) => [
      `Sign up / sign in via Supabase Auth: ${authSummary(m)}.`,
      "Session available server-side; protected routes redirect unauthenticated users.",
      `On first sign-in, create a profile row${m.derived.multiTenant ? " and a personal organization with owner membership" : ""}.`,
      "Sign out everywhere; auth state reflected in UI within one render."
    ],
    acs: (m) => [
      "Given a new user, when they complete sign-up, then a profile" + (m.derived.multiTenant ? " and personal organization exist" : " exists") + " and they land on the app home.",
      "Given no session, when visiting a protected route, then redirect to sign-in and back after success."
    ],
    security: (m) =>
      `${usesSupabase(m) ? "Supabase Auth" : "A single managed auth provider (Supabase Auth is the golden path)"} — no custom credential handling. RLS from the first migration. Auth callbacks validated server-side.`,
    edges: () => "OAuth email collision with existing email account; expired session mid-action; sign-up abandonment.",
    arch: (m) => `${usesSupabase(m) ? "Supabase Auth" : "Your managed auth provider (Supabase Auth recommended)"}${isSpaFramework(m) ? " with supabase-js in a typed auth module" : " with @supabase/ssr session handling in middleware"}; profile creation via a trigger on user signup.`
  },
  organizations: {
    problem: () => "Teams need shared workspaces with controlled membership — tenancy is the backbone of the data model.",
    frs: (m) => [
      "Create organization; auto-membership as owner.",
      "Invite by email; accept flow creates membership with role.",
      `Roles: ${m.roles === "granular" ? "owner, admin, member, viewer (permission matrix in this spec)" : "owner, admin, member"}.`,
      "Switch active organization; all data queries scope to it.",
      "Remove member (admin+); leave organization (non-owner)."
    ],
    acs: () => [
      "Given a member of org A only, when querying any org B resource, then zero rows return (RLS denial test).",
      "Given an invited email, when accepting, then membership exists with the invited role and access works immediately."
    ],
    security: () =>
      "All domain tables carry organization_id; is_org_member() RLS on every one; role checks in write policies; invites are single-use, expiring tokens.",
    edges: () => "Last owner leaving (blocked); invite to existing member; concurrent role changes; org deletion cascade.",
    arch: () => "organizations + organization_members + invites tables (see docs/architecture/DATABASE.md); active-org in session/cookie; org switcher in shell."
  },
  payments: {
    problem: (m) => `${m.name} must convert usage into revenue with subscription billing that never drifts from Stripe's truth.`,
    frs: (m) => [
      `Stripe ${m.audience === "b2c" ? "Checkout for individual plans" : `Billing with per-${m.derived.multiTenant ? "organization" : "user"} subscriptions`}.`,
      "Pricing page reading plans from configuration (single source).",
      "Webhook handler updates local entitlement state (subscription status, plan, period end).",
      "Billing portal link for self-serve management.",
      "Feature gating helper: `hasEntitlement(feature)` used by UI and server."
    ],
    acs: () => [
      "Given a completed checkout, when the webhook lands, then entitlements update without user action within 30s.",
      "Given a canceled subscription, when period ends, then gated features lock and UI communicates why."
    ],
    security: () =>
      "Webhook signatures verified; entitlement changes only via webhook handler; Stripe IDs stored, never card data; portal links generated server-side.",
    edges: () => "Webhook replay/out-of-order events (idempotency keys); checkout abandoned; plan change mid-period (proration); webhook received before local record exists.",
    arch: (m) => `stripe_customers + subscriptions tables keyed to ${t(m.derived.multiTenant, "organization_id", "user_id")}; webhook route with event allowlist; entitlements derived, never hand-set.`
  },
  ai: {
    problem: (m) => `AI is a core capability of ${m.name} — it needs reliability, cost control, and validated outputs, not ad-hoc calls.`,
    frs: (m) => [
      `All LLM calls server-side${isSpaFramework(m) ? " (Edge Functions)" : " (Server Actions / Route Handlers)"} through one typed client module.`,
      "Prompts stored in prompts/ with versions; calls record prompt version + token usage.",
      "Outputs validated (Zod) against expected shape before persistence or display; invalid output retries once with feedback, then fails visibly.",
      "Per-user rate limiting and a monthly cost ceiling with alerting."
    ],
    acs: () => [
      "Given malformed model output, when validation fails twice, then the user sees a designed error state and the failure is logged with prompt version.",
      "Given the rate limit is hit, then the user gets a clear message, not a timeout."
    ],
    security: () =>
      "API key server-side only. User input embedded in prompts is delimited and treated as data (prompt-injection posture). Model outputs sanitized before render, validated before storage.",
    edges: () => "Provider outage (graceful degradation); streaming disconnects; very long inputs (truncation policy); concurrent requests per user.",
    arch: () => "lib/ai module: client, prompt registry, validation contracts, usage logging table (ai_calls: user, prompt_version, tokens, cost, status)."
  },
  storage: {
    problem: () => "Users need to upload and retrieve files safely, with access control that matches the tenancy model.",
    frs: (m) => [
      `Upload via Supabase Storage, bucket policies mirroring ${t(m.derived.multiTenant, "organization membership", "user ownership")}.`,
      "Type/size validation client + server (allowlist per use case).",
      "Signed URLs with short expiry for private files.",
      "Delete removes storage object + database reference atomically."
    ],
    acs: () => [
      "Given a non-member, when requesting another tenant's file URL, then access is denied (policy test).",
      "Given an oversized/wrong-type file, then upload is rejected with a clear message before transfer completes."
    ],
    security: () => "No public buckets by default; content-type sniffing server-side; filenames sanitized; signed URLs never logged.",
    edges: () => "Upload interrupted mid-transfer; duplicate filenames; orphaned objects after failed DB write (cleanup job).",
    arch: (m) => `files table (id, ${t(m.derived.multiTenant, "organization_id", "user_id")}, path, size, mime) + storage bucket with RLS-equivalent policies.`
  },
  search: {
    problem: (m) => `Users must find things in ${m.name} instantly, or its value stays hidden.`,
    frs: () => [
      "Postgres full-text search over primary entities (tsvector columns, GIN indexes).",
      "Search endpoint with tenant scoping, ranked results, and result-type grouping.",
      "Debounced UI (⌘K palette or search field) with keyboard navigation."
    ],
    acs: () => [
      "Given entities matching a query, then results return ranked within 200ms locally, tenant-scoped only.",
      "Given no matches, then a designed empty state appears (no bare 'no results')."
    ],
    security: () => "Search queries scoped through RLS the same as any read; query strings length-capped and treated as data.",
    edges: () => "Special characters in queries; very short queries (min length); stale indexes after bulk updates (trigger maintenance).",
    arch: () => "Generated tsvector columns with triggers; search feature module exposing one typed query; upgrade path to dedicated search noted for scale."
  },
  notifications: {
    problem: () => "Users need to know when relevant things happen without polling or living in the app.",
    frs: (m) => [
      "notifications table (recipient, type, payload, read_at) with typed event catalog.",
      "In-app inbox with unread count and mark-as-read (single + all).",
      `${m.derived.hasRealtime ? "Live delivery via Supabase Realtime subscription." : "Unread count refresh on navigation."}`,
      `${m.features.includes("email") ? "Email fallback for high-importance types (respecting preferences)." : "Per-type preference toggles."}`
    ],
    acs: () => [
      "Given a triggering event, then the recipient's unread count updates and the item renders with correct copy and link.",
      "Given mark-all-read, then count is zero across tabs/sessions."
    ],
    security: () => "Recipients only read their own notifications (RLS); payloads carry IDs, not sensitive content.",
    edges: () => "Notification for deleted entity (dead link handling); event bursts (batching); recipient removed from tenant before read.",
    arch: () => "Event emission helper in the data layer — features emit domain events; a mapper turns events into notifications."
  },
  email: {
    problem: (m) => `${m.name} needs reliable transactional email (invites, receipts, key events) that lands in inboxes.`,
    frs: () => [
      "One email module wrapping the provider (e.g. Resend) with typed templates.",
      "Templates versioned in-repo (React Email or MJML), previewable locally.",
      "Send log table (to, template, status, provider id) for support and debugging.",
      "Unsubscribe/preferences honored for non-critical mail."
    ],
    acs: () => [
      "Given a triggering event, then the email sends with correct personalization and the send is logged.",
      "Given provider failure, then the action still completes and the failure is visible for retry."
    ],
    security: () => "Provider key server-side; no user-controlled HTML injected into templates; send log free of message bodies containing sensitive data.",
    edges: () => "Bounces/invalid addresses; duplicate sends on retries (idempotency); provider rate limits.",
    arch: () => "lib/email module; sends triggered from server-side domain events only — never from client code."
  },
  analytics: {
    problem: (m) => `Without usage insight, ${m.name} can't tell which bets are working — especially the decisions that move it toward "${m.mvpFocus}".`,
    frs: () => [
      "Privacy-respecting product analytics (e.g. PostHog) behind one typed track() helper.",
      "Event catalog in-repo: name, properties, trigger — no ad-hoc event strings.",
      "Core funnel instrumented from day one (activation path).",
      "Dashboards for the 90-day goal metrics."
    ],
    acs: () => [
      "Given the catalog, then every fired event matches a documented name/schema (lint or type-enforced).",
      "Given DNT/opt-out, then no events fire for that user."
    ],
    security: () => "No sensitive data in event properties (IDs only); analytics keys public-safe; opt-out honored.",
    edges: () => "Ad blockers (graceful no-op); server vs client event duplication; anonymous → identified user stitching.",
    arch: () => "lib/analytics with typed event union; provider swap-friendly."
  },
  realtime: {
    problem: () => "Parts of the product must feel live — stale views break the core experience.",
    frs: (m) => [
      `Supabase Realtime subscriptions scoped per ${t(m.derived.multiTenant, "organization", "user")} on the entities that need liveness.`,
      "Optimistic UI with reconciliation on server confirmation.",
      "Presence/connection indicator where liveness matters."
    ],
    acs: () => [
      "Given two sessions on the same data, when one mutates, then the other reflects it within 2s without refresh.",
      "Given a dropped connection, then the UI indicates staleness and recovers on reconnect."
    ],
    security: () => "Channel authorization mirrors RLS — clients subscribe only to rows they can read; no broad table subscriptions.",
    edges: () => "Reconnect storms; out-of-order events; mutation conflicts (last-write-wins vs merge — decide per entity).",
    arch: () => "One subscription manager module; features register narrow channel specs; cleanup on unmount audited."
  },
  admin: {
    problem: (m) => `Operating ${m.name} requires internal visibility and controlled interventions without database spelunking.`,
    frs: () => [
      "Admin area gated by explicit admin flag (not role escalation).",
      "User/tenant lookup with key state (plan, activity, flags).",
      "Safe interventions: e.g. resend invite, unlock account — each logged.",
      "Every admin action writes an audit entry (actor, action, target)."
    ],
    acs: () => [
      "Given a non-admin, when accessing any admin route/action, then denied server-side (not just hidden UI).",
      "Given an admin intervention, then an audit entry exists with actor and target."
    ],
    security: () => "Admin checks server-side on every action; admin routes excluded from search indexing; least-privilege — no raw SQL console.",
    edges: () => "Admin acting on own account; intervention on deleted entities; concurrent admin edits.",
    arch: () => "admin feature module; is_admin flag on profiles; reuses domain data layer with explicit admin-scoped queries."
  },
  audit_logs: {
    problem: (m) => `${m.security === "elevated" ? "Compliance and trust require" : "Accountability requires"} an immutable record of who did what, when.`,
    frs: (m) => [
      `Append-only audit_logs (actor, action, entity type/id, ${t(m.derived.multiTenant, "organization_id, ", "")}metadata, timestamp).`,
      "Domain events write entries via one helper — features never insert directly.",
      `${t(m.derived.multiTenant, "Org admins view their organization's log with filtering.", "Users view their own account activity.")}`
    ],
    acs: () => [
      "Given any sensitive action (auth changes, permission changes, deletions), then an audit entry exists.",
      "Given any actor, then update/delete on audit rows is impossible (no policies exist; denial test)."
    ],
    security: () => "No update/delete RLS policies (append-only by construction); metadata excludes sensitive values; retention policy documented.",
    edges: () => "High-volume actions (sampling policy); entries referencing deleted entities; clock consistency.",
    arch: () => "Single audit() helper in the data layer; JSONB metadata; entity-type + timestamp indexes."
  }
};

export function featureSpecs(m: ProjectModel): GeneratedFile[] {
  return m.features
    .filter((f): f is FeatureId => f in specDefs)
    .map((f) => {
      const d = specDefs[f];
      if (!d) return null;
      return authored(
        `specs/mvp/${f}.md`,
        `specs/feature/${f}`,
        `
# Spec: ${featureLabel[f]}

> Milestone: see docs/ROADMAP.md · Priority: P1 · Status: Draft (review before implementing)

## Problem

${d.problem(m)}

## Business Goal

Serves the MVP promise: "${m.mvpFocus}". See docs/VISION.md.

## User Story

As a ${m.audience === "internal" ? "team member" : "user"} of ${m.name}, I want ${featureLabel[f].toLowerCase()}, so that the product delivers its core value reliably.

## Functional Requirements

${d.frs(m).map((r, i) => `- FR-${i + 1}: ${r}`).join("\n")}

## Non-Functional Requirements

- NFR-1: Meets docs/standards/ performance and quality bars; designed loading/empty/error states.

## Acceptance Criteria

${d.acs(m).map((a, i) => `- [ ] AC-${i + 1}: ${a}`).join("\n")}

## Architecture Notes

${d.arch(m)}

## UX Notes

One clear primary action per screen; states designed before implementation. Adjust to your product's flows during review.

## Dependencies

Foundation setup (Milestone 0)${f !== "auth" && m.derived.needsAuth ? "; authentication" : ""}${f === "roles" || (f !== "organizations" && m.derived.multiTenant && (f === "payments" || f === "audit_logs" || f === "storage")) ? "; organizations" : ""}.

## Risks

Scope growth — implement the FRs above, file everything else to the roadmap's Later section.

## Edge Cases

${d.edges(m)}

## Security

${d.security(m)}

## Testing

Unit: business logic. Integration: RLS/policies (access + denial). E2E: happy path within the critical flow. Per docs/standards/TESTING_STANDARDS.md.

## Definition of Done

- [ ] AC pass · tests green · security done · docs + context/PROGRESS.md updated · reviewed vs spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: Draft
`
      );
    })
    .filter((x): x is GeneratedFile => x !== null);
}
