"use client";

// Adaptive interview runtime (F-301). One question per screen, schema-driven,
// conditions evaluated live, answers persisted per change.
import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import {
  firstUnanswered,
  pruneHiddenAnswers,
  visibleQuestions,
  type InterviewAnswers,
  type Question
} from "@airrow/schemas";
import { Button, Card, Spinner, Textarea } from "@/components/ui";
import { cn } from "@/lib/utils";
import { saveAnswersAction, submitInterviewAction } from "./actions";

interface Props {
  projectId: string;
  projectName: string;
  initialAnswers: InterviewAnswers;
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

export function InterviewRuntime({ projectId, projectName, initialAnswers }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<InterviewAnswers>(initialAnswers);
  const [mode, setMode] = useState<"questions" | "review">(() =>
    firstUnanswered(initialAnswers) === null ? "review" : "questions"
  );
  const [cursor, setCursor] = useState<number>(() => {
    const open = firstUnanswered(initialAnswers);
    if (!open) return 0;
    const idx = visibleQuestions(initialAnswers).findIndex((q) => q.id === open.id);
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
        void saveAnswersAction(projectId, pruneHiddenAnswers(next));
      }, 350);
    },
    [projectId]
  );

  const setAnswer = useCallback(
    (id: Question["id"], value: unknown) => {
      setAnswers((prev) => {
        const next = { ...prev, [id]: value } as InterviewAnswers;
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
      const res = await submitInterviewAction(projectId, pruneHiddenAnswers(answers));
      if (res?.error) setError(res.error);
    });
  };

  /* ── Review screen (F-301 FR-5) ─────────────────────────────────────── */
  if (mode === "review") {
    return (
      <div className="mx-auto max-w-2xl px-8 py-12">
        <p className="font-mono text-xs text-accent">Review</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-fg">
          Ready to generate {projectName}&apos;s foundation
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">
          Check your answers — each one shapes the output. Generation takes under a minute.
        </p>
        <Card className="mt-6 divide-y divide-border">
          {visible.map((q) => (
            <div key={q.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-[13px] text-fg-muted">{q.title}</p>
                <p className="mt-0.5 truncate text-sm font-medium text-fg">
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
          <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-[13px] text-fg-muted">
            Some questions are still unanswered — edit above to finish them.
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex justify-end">
          <Button size="lg" onClick={submit} disabled={submitting || !complete}>
            {submitting ? <Spinner className="border-t-bg" /> : null}
            {submitting ? "Starting generation…" : "Generate foundation"}
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const value = answers[current.id];

  /* ── Question screen ─────────────────────────────────────────────────── */
  return (
    <div className="mx-auto max-w-2xl px-8 py-12">
      <div className="flex items-center justify-between">
        <p className="font-mono text-xs text-fg-faint">
          {projectName} · question {Math.min(cursor + 1, visible.length)} of {visible.length}
        </p>
        <div className="h-1 w-32 overflow-hidden rounded-full bg-surface-raised">
          <div
            className="h-full bg-accent transition-all duration-300"
            style={{ width: `${((cursor + 1) / visible.length) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="mt-6 text-xl font-semibold tracking-tight text-fg">{current.title}</h1>
      {current.help ? (
        <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{current.help}</p>
      ) : null}

      <div className="mt-6">
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
                    "cursor-pointer rounded-lg border px-4 py-3.5 text-left transition-colors",
                    selected
                      ? "border-accent bg-accent-muted"
                      : "border-border bg-surface hover:border-border-strong"
                  )}
                >
                  <span className="block text-sm font-medium text-fg">{o.label}</span>
                  {o.description ? (
                    <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">
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
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                      selected
                        ? "border-accent bg-accent-muted"
                        : "border-border bg-surface hover:border-border-strong"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                        selected ? "border-accent bg-accent text-bg" : "border-border-strong"
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-fg">{o.label}</span>
                      {o.description ? (
                        <span className="mt-0.5 block text-[13px] leading-snug text-fg-muted">
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
              maxLength={2000}
              onChange={(e) => setAnswer(current.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (typeof value === "string" && value.trim()) advance();
                }
              }}
            />
            <div className="mt-5 flex items-center justify-between">
              <span className="font-mono text-[11px] text-fg-faint">⌘↵ to continue</span>
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
          onClick={() => (cursor === 0 ? router.push("/app") : setCursor((c) => Math.max(0, c - 1)))}
          className="flex cursor-pointer items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-fg"
        >
          <ArrowLeft className="size-3.5" />
          {cursor === 0 ? "Back to projects" : "Previous question"}
        </button>
        {complete ? (
          <button
            type="button"
            onClick={() => setMode("review")}
            className="cursor-pointer text-[13px] text-fg-muted transition-colors hover:text-fg"
          >
            Skip to review →
          </button>
        ) : null}
      </div>
    </div>
  );
}
