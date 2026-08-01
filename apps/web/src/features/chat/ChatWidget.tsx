"use client";

// Archer, the chat panel (spec 141, moved off the landing page and named by spec 158).
//
// Three things it must never do: render an answer as markup, keep anything after the tab closes, or
// break the page it sits on. The first is why every answer goes through `<p>{text}</p>` and nothing
// else — the model's output is untrusted text, and there is no HTML path for it to travel down (§III).
// The second is why the thread lives in `sessionStorage` rather than a cookie or `localStorage`. The
// third is why every failure lands in `fallback`, which is a real state with handwritten answers in
// it rather than an error.
//
// Mounted once, from `app/(public)/layout.tsx`. It is deliberately not imported by any page: the next
// public page should get Archer by existing, not by someone remembering to add him.
import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SUPPORT_PATH } from "@/features/support/route";
import { cn } from "@/lib/utils";
import { ARCHER, CHAT } from "./copy";
import type { ChatReply, ChatTurn } from "./contract";
// `faq.ts`, never `knowledge.ts` — this component is bundled for the browser and the knowledge base
// the model reads has no business being there.
import { FAQ, SUGGESTED_QUESTIONS } from "./faq";
import { MAX_MESSAGE_CHARS, MAX_THREAD_TURNS } from "./limits";

/** Survives a reload, never the tab. Deliberately not a cookie: no consent question arises. */
const STORAGE_KEY = "airrow.chat.thread";

function readStoredThread(): ChatTurn[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Storage is the visitor's own and can hold anything by the time it comes back; the shape is
    // re-checked here so a hand-edited entry cannot reach the request body unexamined.
    return parsed.filter(
      (turn): turn is ChatTurn =>
        typeof turn === "object" &&
        turn !== null &&
        (("role" in turn && turn.role === "visitor") || ("role" in turn && turn.role === "assistant")) &&
        "text" in turn &&
        typeof turn.text === "string" &&
        turn.text.length > 0 &&
        turn.text.length <= MAX_MESSAGE_CHARS
    );
  } catch {
    return [];
  }
}

/**
 * Archer's face (spec 158).
 *
 * Served at full resolution from `public/brand/` and sized down by `next/image`, the same way the
 * lockup is. Deliberately *without* `brand-asset`: that class darkens artwork in the light theme so
 * the logo's near-white silver does not vanish against white, and this avatar is its own black disc —
 * the same filter would only turn its highlights to mud. It reads as intended in both themes.
 */
function ArcherAvatar({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/archer-avatar.png"
      alt={CHAT.avatarAlt}
      width={1254}
      height={1254}
      className={cn("shrink-0 rounded-full", className)}
    />
  );
}

/** The sentence shown instead of the conversation, once the panel has stopped answering. */
function fallbackNoteFor(replyStatus: ChatReply["status"], scope?: "visitor" | "global"): string {
  if (replyStatus === "thread_full") return CHAT.threadFull;
  if (replyStatus === "limited") return scope === "visitor" ? CHAT.visitorLimit : CHAT.globalLimit;
  return CHAT.unavailable;
}

export function ChatWidget({ ctaHref }: { ctaHref: string }) {
  const [open, setOpen] = React.useState(false);
  const [thread, setThread] = React.useState<ChatTurn[]>([]);
  const [question, setQuestion] = React.useState("");
  const [sending, setSending] = React.useState(false);
  /** Non-null once the panel has stopped taking questions, and it carries the reason. */
  const [fallback, setFallback] = React.useState<string | null>(null);
  /** Set once Archer has judged that a person is what they need; it never goes back (spec 158). */
  const [supportOffered, setSupportOffered] = React.useState(false);
  const transcriptRef = React.useRef<HTMLDivElement>(null);

  // Restoring the thread on mount, not fetching data — `sessionStorage` does not exist during the
  // server render, so reading it any earlier would hydrate a different tree than the server sent.
  React.useEffect(() => {
    setThread(readStoredThread());
  }, []);

  React.useEffect(() => {
    if (thread.length > 0) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(thread));
  }, [thread]);

  React.useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [thread, sending, fallback]);

  const askedCount = thread.filter((turn) => turn.role === "visitor").length;
  const atThreadCeiling = askedCount >= MAX_THREAD_TURNS;

  async function ask(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed || sending || fallback) return;

    const next: ChatTurn[] = [...thread, { role: "visitor", text: trimmed.slice(0, MAX_MESSAGE_CHARS) }];
    setThread(next);
    setQuestion("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thread: next })
      });
      const reply: ChatReply = await res.json();

      if (reply.status === "answered") {
        setThread([...next, { role: "assistant", text: reply.text }]);
        if (reply.support) setSupportOffered(true);
      } else if (reply.status === "off_topic") {
        setThread([...next, { role: "assistant", text: CHAT.offTopic }]);
      } else {
        setFallback(fallbackNoteFor(reply.status, reply.status === "limited" ? reply.scope : undefined));
      }
    } catch {
      // A dropped connection is ours to absorb, exactly like an unreachable model.
      setFallback(CHAT.unavailable);
    } finally {
      setSending(false);
    }
  }

  if (!open) {
    return (
      <Button
        variant="secondary"
        className="fixed bottom-5 right-5 z-40 shadow-e1"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="size-4" />
        {CHAT.launcher}
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-label={CHAT.title}
      className="fixed inset-x-3 bottom-3 z-40 flex max-h-[80dvh] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-e1 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:w-96"
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <ArcherAvatar className="size-9" />
          <div>
            <p className="text-base font-medium text-fg">{CHAT.title}</p>
            <p className="mt-0.5 text-sm text-fg-muted">{CHAT.subtitle}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" aria-label={CHAT.close} onClick={() => setOpen(false)}>
          <X className="size-4" />
        </Button>
      </header>

      <div ref={transcriptRef} className="flex-1 overflow-y-auto px-4 py-4">
        {thread.length === 0 && !fallback ? (
          <div>
            <p className="text-sm text-fg-muted">{CHAT.suggestionsLabel}</p>
            <div className="mt-3 grid gap-2">
              {SUGGESTED_QUESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void ask(suggestion)}
                  className="cursor-pointer rounded-md border border-border px-3 py-2 text-left text-base text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4">
          {thread.map((turn, index) => (
            <div key={`${turn.role}-${index}`}>
              {turn.role === "visitor" ? (
                <p className="text-sm text-fg-faint">You</p>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-fg-faint">
                  <ArcherAvatar className="size-5" />
                  {ARCHER}
                </p>
              )}
              {/* Text, and only ever text. The model's answer never becomes markup. */}
              <p className="mt-1 whitespace-pre-wrap text-base text-fg">{turn.text}</p>
            </div>
          ))}
        </div>

        {sending ? (
          <p className="mt-4 flex items-center gap-2 text-base text-fg-muted">
            <Spinner className="size-4" />
            {CHAT.thinking}
          </p>
        ) : null}

        {fallback ? (
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-base text-fg-muted">{fallback}</p>
            <p className="mt-4 text-sm text-fg-faint">{CHAT.faqIntro}</p>
            <div className="mt-3 grid gap-4">
              {FAQ.map((entry) => (
                <div key={entry.question}>
                  <p className="text-base font-medium text-fg">{entry.question}</p>
                  <p className="mt-1 text-base text-fg-muted">{entry.answer}</p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <footer className="border-t border-border px-4 py-3">
        {/* The hand-off is the panel's own row, not something the model wrote: it says the sign-in
            step out loud, and the destination is a constant no answer can influence. Always shown in
            the fallback states, because a panel that has stopped answering is exactly when someone
            needs the person behind it. */}
        {supportOffered || fallback ? (
          <div className="mb-3 grid gap-2 border-b border-border pb-3">
            <p className="text-sm text-fg-muted">{CHAT.supportNote}</p>
            <Button variant="secondary" asChild className="w-full">
              <Link href={SUPPORT_PATH}>{CHAT.supportAction}</Link>
            </Button>
          </div>
        ) : null}

        {fallback || atThreadCeiling ? (
          <div className="grid gap-2">
            <p className="text-sm text-fg-muted">{CHAT.ctaNote}</p>
            <Button asChild className="w-full">
              <Link href={ctaHref}>{CHAT.cta}</Link>
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void ask(question);
            }}
            className="flex items-center gap-2"
          >
            <Input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={CHAT.placeholder}
              maxLength={MAX_MESSAGE_CHARS}
              aria-label={CHAT.placeholder}
              disabled={sending}
            />
            <Button type="submit" disabled={sending || question.trim().length === 0}>
              {CHAT.send}
            </Button>
          </form>
        )}
      </footer>
    </div>
  );
}
