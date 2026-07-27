"use client";

// Adaptive interview runtime (F-301). One question per screen, schema-driven,
// conditions evaluated live, answers persisted per change.
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import {
  firstUnanswered,
  isRecommendedOption,
  pruneHiddenAnswers,
  visibleQuestions,
  withSuggestions,
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
import { InlineError } from "@/components/ui/states";
import { cn } from "@/lib/utils";

/**
 * Persistence and submission are injected rather than imported, so the signed-in and
 * signed-out interviews run the *same* question logic over different back ends: server
 * actions for a real project, `localStorage` plus a sign-in wall for a guest.
 */
interface Props {
  projectName: string;
  initialAnswers: InterviewAnswers;
  /** The project already has a generated foundation — submitting replaces it. */
  regenerating?: boolean;
  /** Called (debounced) on every answer change with the pruned answer set. */
  persist: (answers: InterviewAnswers) => void;
  /** Final action. Resolve with an error message to show it inline; void means handled. */
  submit: (answers: InterviewAnswers) => Promise<{ error?: string } | void>;
  submitLabel: string;
  pendingLabel: string;
  /** Where the "back" affordance leads out of the interview. */
  back: { href: string; label: string };
}

function answerLabel(q: Question, answers: InterviewAnswers): string {
  const v = answers[q.id];
  if (v === undefined) return "—";
  if (Array.isArray(v)) {
    return v.map((x) => q.options?.find((o) => o.value === x)?.label ?? x).join(", ");
  }
  if (q.type === "text") return String(v);
  return q.options?.find((o) => o.value === String(v))?.label ?? String(v);
}

export function InterviewRuntime({
  projectName,
  initialAnswers,
  regenerating = false,
  persist: persistAnswers,
  submit: submitAnswers,
  submitLabel,
  pendingLabel,
  back
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
  const [submitting, startSubmit] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => visibleQuestions(answers), [answers]);
  const complete = useMemo(() => firstUnanswered(answers) === null, [answers]);
  const current = visible[Math.min(cursor, visible.length - 1)];

  const persist = useCallback(
    (next: InterviewAnswers) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        persistAnswers(pruneHiddenAnswers(next));
      }, 350);
    },
    [persistAnswers]
  );

  const setAnswer = useCallback(
    (id: Question["id"], value: unknown) => {
      setAnswers((prev) => {
        // Suggestions are re-applied on every change, not once: one answer can suggest another, and
        // an earlier answer is editable from the review screen long after it was first given.
        const next = withSuggestions({ ...prev, [id]: value } as InterviewAnswers);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const advance = useCallback(() => {
    setAnswers((prev) => {
      const vis = visibleQuestions(prev);
      const idx = vis.findIndex((q) => q.id === current?.id);
      if (idx >= 0 && idx < vis.length - 1) setCursor(idx + 1);
      else setMode("review");
      return prev;
    });
  }, [current]);

  const submit = () => {
    setError(null);
    startSubmit(async () => {
      const res = await submitAnswers(pruneHiddenAnswers(answers));
      if (res?.error) setError(res.error);
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
        <Card className="mt-6 divide-y divide-border">
          {visible.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm text-fg-muted">{q.title}</p>
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
        {error ? <InlineError className="mt-4">{error}</InlineError> : null}
        <div className="mt-6 flex items-center justify-between gap-4">
          {regenerating ? (
            <Button variant="ghost" size="lg" onClick={() => router.push(back.href)} disabled={submitting}>
              <ArrowLeft className="size-3.5" />
              {back.label}
            </Button>
          ) : (
            <span />
          )}
          <Button size="lg" onClick={submit} disabled={submitting || !complete}>
            {submitting ? <Spinner className="border-t-bg" /> : null}
            {submitting ? pendingLabel : submitLabel}
          </Button>
        </div>
      </PageContainer>
    );
  }

  if (!current) return null;

  const value = answers[current.id];

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
            <div className="mt-5 flex items-center justify-between">
              <span className="font-mono text-2xs text-fg-faint">⌘↵ to continue</span>
              <Button onClick={advance} disabled={typeof value !== "string" || !value.trim()}>
                Continue
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
