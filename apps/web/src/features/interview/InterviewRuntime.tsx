"use client";

// Adaptive interview runtime (F-301). One question per screen, schema-driven,
// conditions evaluated live, answers persisted per change.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import {
  ANSWER_MAX_CHARS,
  firstUnanswered,
  isRecommendedOption,
  pruneHiddenAnswers,
  uiKitCaption,
  uiKitFor,
  visibleQuestions,
  withSuggestions,
  type AnswerId,
  type InterviewAnswers,
  type Question
} from "@airrow/schemas";
import { PageContainer } from "@/components/shell/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { InlineError, Notice, UpgradeNotice } from "@/components/ui/states";
import { captureClient } from "@/features/analytics/client";
import { rejectionSummary } from "@/features/generation/rejection";
import { cn } from "@/lib/utils";
import { UiKitPreview } from "./UiKitPreview";
import { UiReferences, type ReferenceUploads } from "./UiReferences";

/**
 * Persistence and submission are injected rather than imported, so the signed-in and
 * signed-out interviews run the *same* question logic over different back ends: server
 * actions for a real project, `localStorage` plus a sign-in wall for a guest.
 */
interface Props {
  projectName: string;
  /**
   * Which of the two interviews this is (spec 182).
   *
   * Passed rather than inferred from `uploads` or `destroy` being absent. Those happen to be
   * undefined on the guest path today, and a funnel that quietly re-labels itself the day one of
   * them is added to guests is worse than a prop.
   */
  mode: "guest" | "account";
  initialAnswers: InterviewAnswers;
  /** The project already has a generated foundation — submitting replaces it. */
  regenerating?: boolean;
  /** Called (debounced) on every answer change with the pruned answer set. */
  persist: (answers: InterviewAnswers) => void;
  /**
   * Final action. Resolve with an error message to show it inline; void means handled.
   *
   * `upgrade` distinguishes "you have run out" from "something went wrong" (spec 100). They are not
   * the same event and must not look the same: one is a failure, the other is a price.
   */
  submit: (answers: InterviewAnswers) => Promise<{ error?: string; upgrade?: boolean } | void>;
  submitLabel: string;
  pendingLabel: string;
  /** Where the "back" affordance leads out of the interview. */
  back: { href: string; label: string };
  /**
   * The answers the last generation was refused for, if it was (spec 128). Null on every ordinary
   * visit — including a founder who simply walked back here, which is why it comes from the job
   * rather than from where they came from.
   */
  rejectedAnswers?: readonly AnswerId[] | null;
  /**
   * How screenshots are attached, when they can be at all (spec 159). Injected like `persist` and
   * `submit`, and `undefined` on the guest path — where there is no project to hang an upload off,
   * and no unauthenticated write path to invent for one.
   */
  uploads?: ReferenceUploads;
  /**
   * The way out, for a project that has one (spec 165).
   *
   * Rendered on the review screen beside the generate button. A node rather than a callback, so the
   * confirmation dialog and the server action stay in `features/projects` where they belong and this
   * runtime keeps knowing nothing about how a project is deleted. `undefined` on the guest path:
   * there is no project yet, and closing the tab is already the way out.
   */
  destroy?: React.ReactNode;
}

function answerLabel(q: Question, answers: InterviewAnswers): string {
  const v = answers[q.id];
  if (v === undefined) return "—";
  if (Array.isArray(v)) {
    return v.map((x) => q.options?.find((o) => o.value === x)?.label ?? x).join(", ");
  }
  // The design row summarises what the founder wrote *and* what they pointed at, because both are
  // now answers to the same question (spec 165). The images are not in `answers` at all — they live
  // in the database — so the only honest thing to add here is the links.
  if (q.type === "guided_text" && q.references) {
    const links = String(answers.uiReferenceLinks ?? "").trim();
    return links ? `${String(v)} — showing us ${links}` : String(v);
  }
  if (q.type === "text" || q.type === "guided_text") return String(v);
  return q.options?.find((o) => o.value === String(v))?.label ?? String(v);
}

export function InterviewRuntime({
  projectName,
  mode: interviewMode,
  initialAnswers,
  regenerating = false,
  persist: persistAnswers,
  submit: submitAnswers,
  submitLabel,
  pendingLabel,
  back,
  rejectedAnswers = null,
  uploads,
  destroy
}: Props) {
  const router = useRouter();
  // A resumed interview is seeded the same way a live one is, so where the founder left off is
  // measured against the answers they will actually see.
  const seeded = useMemo(() => withSuggestions(initialAnswers), [initialAnswers]);
  const [answers, setAnswers] = useState<InterviewAnswers>(seeded);
  const [mode, setMode] = useState<"questions" | "review">(() =>
    firstUnanswered(seeded) === null ? "review" : "questions"
  );
  const [cursor, setCursor] = useState<number>(() => {
    const open = firstUnanswered(seeded);
    if (!open) return 0;
    const idx = visibleQuestions(seeded).findIndex((q) => q.id === open.id);
    return idx === -1 ? 0 : idx;
  });
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => visibleQuestions(answers), [answers]);
  const complete = useMemo(() => firstUnanswered(answers) === null, [answers]);
  const current = visible[Math.min(cursor, visible.length - 1)];
  const rejected = useMemo(() => new Set(rejectedAnswers ?? []), [rejectedAnswers]);

  const persist = useCallback(
    (next: InterviewAnswers) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persistAnswers(pruneHiddenAnswers(next));
      }, 350);
    },
    [persistAnswers]
  );

  /**
   * Apply one or more answers at once.
   *
   * More than one because picking a curated design direction sets two — the words it writes into the
   * field, and the `uiKit` that records which was picked (spec 165). Applying them in one update
   * keeps them from ever being observed apart: a render between the two would show a highlighted
   * option whose text had not arrived yet.
   */
  const applyAnswers = useCallback(
    (patch: Partial<InterviewAnswers>) => {
      setAnswers((prev) => {
        // Suggestions are re-applied on every change, not once: one answer can suggest another, and
        // an earlier answer is editable from the review screen long after it was first given.
        const next = withSuggestions({ ...prev, ...patch } as InterviewAnswers);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const setAnswer = useCallback(
    (id: Question["id"], value: unknown) => applyAnswers({ [id]: value } as Partial<InterviewAnswers>),
    [applyAnswers]
  );

  // The top of the funnel's second step (spec 182). Once per mounted interview, regardless of how
  // many questions the founder then gets through — including none, which is the number this exists to
  // measure against.
  useEffect(() => {
    captureClient("interview_started", { mode: interviewMode });
  }, [interviewMode]);

  const advance = useCallback(() => {
    // The question *just completed*, with where it sat — this is the drop-off curve (spec 182). The
    // id is the question's, never the answer's: what was typed into it never leaves the browser
    // (§II). Emitted here rather than inside the updater below, because a state updater must stay
    // pure — React is free to run it twice, and under StrictMode it does, which would report every
    // interview as twice as long as it was.
    const shown = visible.findIndex((q) => q.id === current?.id);
    if (current && shown >= 0) {
      captureClient("interview_step", {
        question: current.id,
        index: shown + 1,
        total: visible.length
      });
    }

    setAnswers((prev) => {
      const vis = visibleQuestions(prev);
      const idx = vis.findIndex((q) => q.id === current?.id);
      if (idx >= 0 && idx < vis.length - 1) setCursor(idx + 1);
      else setMode("review");
      return prev;
    });
  }, [current, visible]);

  const submit = () => {
    setError(null);
    setUpgrade(false);
    startSubmit(async () => {
      const res = await submitAnswers(pruneHiddenAnswers(answers));
      if (res?.error) setError(res.error);
      if (res?.upgrade) setUpgrade(true);
    });
  };

  /* ── Review screen (F-301 FR-5) ─────────────────────────────────────── */
  if (mode === "review") {
    return (
      <PageContainer className="max-w-2xl animate-slide-up py-12">
        <p className="font-mono text-xs text-fg-faint">{regenerating ? "Change answers" : "Review"}</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-fg">
          {regenerating
            ? `Regenerate ${projectName}'s foundation`
            : `Ready to generate ${projectName}'s foundation`}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-fg-muted">
          {regenerating
            ? "Change any answer, then regenerate. This builds a fresh foundation — edits you made to the current files are not carried over."
            : "Check your answers — each one shapes the output. Generation takes under a minute."}
        </p>
        {/* The last run stopped on these answers rather than generating around them (spec 128). A
            caution, not an error: nothing failed and nothing was lost — there is something to rewrite.
            Short, because the rows below carry which ones. */}
        {rejectedAnswers ? (
          <Notice role="status" title="These answers weren't accepted" className="mt-6">
            {rejectionSummary(rejectedAnswers)}
          </Notice>
        ) : null}
        <Card className="mt-6 divide-y divide-border">
          {visible.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm text-fg-muted">
                  {q.title}
                  {/* Beside the question, not under the answer: what the founder is scanning for is
                      which rows to open, and the pencil to open one is on the same line. */}
                  {rejected.has(q.id) ? <Badge tone="warn">Rewrite this</Badge> : null}
                </p>
                <p className="mt-0.5 truncate text-base font-medium text-fg">
                  {answerLabel(q, answers)}
                </p>
              </div>
              <button
                type="button"
                className="mt-1 shrink-0 cursor-pointer text-fg-faint transition-colors hover:text-fg"
                aria-label={`Edit ${q.title}`}
                onClick={() => {
                  const idx = visible.findIndex((x) => x.id === q.id);
                  setCursor(idx === -1 ? 0 : idx);
                  setMode("questions");
                }}
              >
                <Pencil className="size-3.5" />
              </button>
            </div>
          ))}
        </Card>
        {!complete ? (
          <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-muted">
            Some questions are still unanswered — edit above to finish them.
          </p>
        ) : null}
        {/* Running out is not a failure, so it does not borrow the danger tone. The answers are
            saved either way — the founder loses nothing by following this link (spec 100). */}
        {upgrade ? (
          <UpgradeNotice
            role="status"
            className="mt-4"
            action={
              <Button size="sm" asChild>
                <Link href="/app/upgrade">See what Pro gives</Link>
              </Button>
            }
          >
            {error}
          </UpgradeNotice>
        ) : error ? (
          <InlineError className="mt-4">{error}</InlineError>
        ) : null}
        <div className="mt-6 flex items-center justify-between gap-4">
          {regenerating ? (
            <Button variant="ghost" size="lg" onClick={() => router.push(back.href)} disabled={submitting}>
              <ArrowLeft className="size-3.5" />
              {back.label}
            </Button>
          ) : (
            <span />
          )}
          {/* Deleting sits beside generating, not opposite it: a founder whose answers were refused
              is deciding between rewriting and abandoning, and both choices belong on the screen
              where the decision is made. */}
          <div className="flex items-center gap-3">
            {destroy}
            <Button size="lg" onClick={submit} disabled={submitting || !complete}>
              {submitting ? <Spinner className="border-t-bg" /> : null}
              {submitting ? pendingLabel : submitLabel}
            </Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!current) return null;

  const value = answers[current.id];
  const hasText = typeof value === "string" && value.trim() !== "";

  /**
   * Show the link field and the upload.
   *
   * True once the founder takes the option that says they will show us — and true from then on if
   * they pasted something, because a field carrying their own words must not disappear behind a
   * later click on one of the five (spec 165).
   */
  const showReferences =
    answers.uiKit === undefined || String(answers.uiReferenceLinks ?? "").trim() !== "";

  /* ── Question screen ─────────────────────────────────────────────────── */
  return (
    <PageContainer className="max-w-2xl py-12">
      <div className="flex items-center justify-between gap-4">
        <p className="font-mono text-xs text-fg-faint">
          {projectName} · question {Math.min(cursor + 1, visible.length)} of {visible.length}
        </p>
        <Progress
          value={((cursor + 1) / visible.length) * 100}
          aria-label="Interview progress"
          className="w-32"
        />
      </div>

      {/* Keyed on the question so each step animates in rather than swapping. */}
      <h1 key={`${current.id}-title`} className="mt-6 animate-slide-up text-2xl font-semibold tracking-tight text-fg">
        {current.title}
      </h1>
      {current.help ? (
        <p className="mt-2 animate-slide-up text-base leading-relaxed text-fg-muted">{current.help}</p>
      ) : null}

      <div key={current.id} className="mt-6 animate-slide-up">
        {current.type === "single" && current.options ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {current.options.map((o) => {
              const selected = value === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    setAnswer(current.id, o.value);
                    setTimeout(advance, 160);
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border px-4 py-3.5 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                    selected
                      ? "border-accent bg-accent-soft"
                      : "border-border bg-surface hover:border-border-strong hover:shadow-e2"
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="text-base font-medium text-fg">{o.label}</span>
                    {/* Which option is recommended can depend on an earlier answer — a mobile app
                        and a SaaS are pointed at different stacks — so it is rendered here rather
                        than written into the label. */}
                    {isRecommendedOption(current, o, answers) ? (
                      <Badge tone="accent">Recommended</Badge>
                    ) : null}
                  </span>
                  {o.description ? (
                    <span className="mt-0.5 block text-sm leading-snug text-fg-muted">
                      {o.description}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {current.type === "multi" && current.options ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {current.options.map((o) => {
                const arr = Array.isArray(value) ? (value as string[]) : [];
                const selected = arr.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => {
                      const next = selected ? arr.filter((x) => x !== o.value) : [...arr, o.value];
                      setAnswer(current.id, next);
                    }}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-border bg-surface hover:border-border-strong hover:shadow-e2"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                        selected ? "border-fg bg-fg text-bg" : "border-border-strong"
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    <span>
                      <span className="block text-base font-medium text-fg">{o.label}</span>
                      {o.description ? (
                        <span className="mt-0.5 block text-sm leading-snug text-fg-muted">
                          {o.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                onClick={advance}
                disabled={!Array.isArray(value) || (value as string[]).length === 0}
              >
                Continue
              </Button>
            </div>
          </>
        ) : null}

        {/* A text answer with starting points above it (spec 159). Picking one writes its words into
            the field; the founder then edits them, and what they end up with is the answer.
            As of spec 165 a pick is also a theme `/start` installs, so it is *stored* in `uiKit`
            rather than derived from the prose: editing the words must not cancel an install. */}
        {current.type === "guided_text" && current.options ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {current.options.map((o) => {
                const kit = uiKitFor(o.value);
                const selected = kit ? answers.uiKit === kit.id : answers.uiKit === undefined;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() =>
                      applyAnswers({
                        [current.id]: o.prefill ?? "",
                        // Only the "my own words" option clears the pick — see `InterviewAnswers.uiKit`.
                        uiKit: kit?.id
                      } as Partial<InterviewAnswers>)
                    }
                    className={cn(
                      "cursor-pointer overflow-hidden rounded-lg border text-left transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-border bg-surface hover:border-border-strong hover:shadow-e2"
                    )}
                  >
                    {kit ? <UiKitPreview kit={kit} /> : null}
                    <span className="block px-4 py-3">
                      <span className="block text-base font-medium text-fg">{o.label}</span>
                      {o.description ? (
                        <span className="mt-0.5 block text-sm leading-snug text-fg-muted">
                          {o.description}
                        </span>
                      ) : null}
                      {/* The picture, in words — and true of whichever picture is above it: the
                          anatomy line for a drawing, the installed blocks for a capture. Never a
                          count the founder cannot see (spec 165). */}
                      {kit ? (
                        <span className="mt-2 block text-sm leading-snug text-fg-faint">
                          {uiKitCaption(kit)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <Textarea
              rows={4}
              className="mt-4"
              value={typeof value === "string" ? value : ""}
              placeholder={current.placeholder}
              maxLength={current.maxChars}
              onChange={(e) => setAnswer(current.id, e.target.value)}
            />

            {/* References live on this screen rather than the next one: they answer the question
                already being asked, so asking again on its own screen asked the same thing twice
                (spec 165, folding spec 159's separate screen back in).
                They appear when the founder takes the option that says they will show us, and stay
                once anything has been pasted — a field with the founder's own words in it is never
                hidden from them by a later click. */}
            {current.references && showReferences ? (
              <div className="mt-6 border-t border-border pt-6">
                <UiReferences
                  links={typeof answers.uiReferenceLinks === "string" ? answers.uiReferenceLinks : ""}
                  onLinksChange={(v) => setAnswer("uiReferenceLinks", v)}
                  maxChars={ANSWER_MAX_CHARS.uiReferenceLinks}
                  placeholder="linear.app  stripe.com/dashboard"
                  uploads={uploads}
                />
              </div>
            ) : null}

            <div className="mt-6 flex items-center justify-between max-sm:justify-end">
              <span className="text-sm text-fg-faint max-sm:hidden">
                {hasText ? "Edit it however you like — these are your words now." : "Pick one to start from, or just write your own."}
              </span>
              <Button onClick={advance}>{hasText ? "Continue" : "Skip"}</Button>
            </div>
          </>
        ) : null}

        {current.type === "text" ? (
          <>
            <Textarea
              rows={4}
              autoFocus
              value={typeof value === "string" ? value : ""}
              placeholder={current.placeholder}
              // The question carries its own ceiling; the same number backs the Zod schema, so the
              // field can't accept something the save would silently reject.
              maxLength={current.maxChars}
              onChange={(e) => setAnswer(current.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (typeof value === "string" && value.trim()) advance();
                }
              }}
            />
            <div className="mt-5 flex items-center justify-between max-sm:justify-end">
              {/* Hidden on a phone: it points at a keyboard shortcut there is no keyboard for. */}
              <span className="font-mono text-2xs text-fg-faint max-sm:hidden">⌘↵ to continue</span>
              {/* An optional question that cannot be passed is a required one wearing a friendlier
                  help text. The button says which it is (spec 159). */}
              <Button onClick={advance} disabled={current.required && !hasText}>
                {!current.required && !hasText ? "Skip" : "Continue"}
              </Button>
            </div>
          </>
        ) : null}

      </div>

      <div className="mt-10 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (cursor > 0) return setCursor((c) => Math.max(0, c - 1));
            router.push(back.href);
          }}
          className="flex cursor-pointer items-center gap-1.5 text-sm text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          {cursor > 0 ? "Previous question" : back.label}
        </button>
        {complete ? (
          <button
            type="button"
            onClick={() => setMode("review")}
            className="cursor-pointer text-sm text-fg-muted transition-colors hover:text-fg"
          >
            Skip to review →
          </button>
        ) : null}
      </div>
    </PageContainer>
  );
}
