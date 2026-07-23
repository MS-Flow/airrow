# Spec: F-301 — Adaptive interview

> Milestone: M3 · Epic: E3.1–E3.4 · Priority: P1 · Owner: CTO

## Problem

Arrow's input is CTO judgment captured from the founder. A static form can't adapt and overwhelms.

## Business Goal

The interview IS the product experience pre-generation; answer quality determines output quality (Constitution §5: every question must change the output).

## User Story

As a founder, I want to answer only relevant questions, one at a time, so that Arrow captures my project without overwhelming me.

## Functional Requirements

- FR-1: Declarative question schema in `packages/schemas` (`interviewQuestions`): id, title, help, type (single | multi | text), options (value/label/description), required, and `showIf` conditions ({questionId, in: values[]}).
- FR-2: Runtime renders one question per screen with progress ("Question 3 of ~9"), Back, and keyboard support (Enter to continue).
- FR-3: Conditions evaluated live: hidden questions are skipped and their answers dropped from the final answer set.
- FR-4: Answers persist per keystroke/selection debounce via server action; refresh resumes at first unanswered question.
- FR-5: Final review screen lists all Q/A with per-question edit before "Generate foundation".
- FR-6: Submission validates the complete answer set (Zod), resolves the ProjectModel (engine), stores it versioned, sets status `generating`, creates a job, and redirects.
- FR-7: Question set v1 (schema_version `1`): productType, audience (skip if internal_tool), features (multi), roles (only if organizations selected), framework (skip for mobile/api/extension), repoProvider, team, security, scale, mvpFocus (text), goal90 (text).

## Non-Functional Requirements

- NFR-1: Transition between questions < 150ms, no full page reload.

## Acceptance Criteria

- [ ] AC-1: Selecting internal_tool never shows audience; deselecting organizations removes roles from flow and answers.
- [ ] AC-2: Refresh mid-interview resumes with prior answers intact.
- [ ] AC-3: Review screen edit → returns to review after answering.
- [ ] AC-4: Submit produces a stored project_model and a queued job.

## Architecture Notes

Client interview runtime (`features/interview`) reading schema from `@arrow/schemas`; persistence via `saveInterview` action; schema is the single source shared with engine resolution. `schema_version` stored with answers.

## UX Notes

Card options with descriptions; selected state accent border; multi-select chips; text steps get one large textarea; quiet help text under each title. Setup-wizard feel, zero dashboard chrome.

## Dependencies

F-101 (model resolution), F-205.

## Risks

Question bloat → constitution §5 review at each milestone; currently ≤ 11 questions, ≥ 2 conditional.

## Edge Cases

Back past first question (disabled); changing an answer that hides later answered questions (dropped + review reflects); empty text answers (required validation); double submit (job idempotent per model version).

## Security

Answers are user input: Zod-validated, length-capped, stored as data, never executed; engine treats them as text.

## Testing

Condition-evaluator unit tests in smoke script; flow manually verified; Playwright path is logged debt.

## Definition of Done

- [ ] AC pass · context updated · Reviewed against spec

## Implementation Notes

—

## Review Notes

—

## Completion Status

Status: In Review — implementation complete; AC verification pending first local run
