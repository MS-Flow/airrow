"use client";

// The signed-out interview. Same runtime and same question set as the signed-in one —
// only the back end differs: answers go to localStorage, and "generate" becomes a
// sign-in wall. Nothing reaches the server until an account claims the draft.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { projectCreateSchema, type InterviewAnswers } from "@airrow/schemas";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { InlineError } from "@/components/ui/states";
import { InterviewRuntime } from "./InterviewRuntime";
import { readDraft, storageAvailable, writeDraft } from "./draft";
import { GUEST_DRAFT_VERSION } from "./draft-schema";

interface Basics {
  name: string;
  description: string;
}

export function GuestInterview() {
  const router = useRouter();
  const [persistent, setPersistent] = useState(true);
  const [basics, setBasics] = useState<Basics | null>(null);
  const [initialAnswers, setInitialAnswers] = useState<InterviewAnswers>({});
  const [error, setError] = useState<string | null>(null);

  // Storage is client-only, so a resumed draft can't be known until after hydration.
  // The first paint is therefore step 1 — right for every first-time visitor, and one
  // frame stale for the rarer returning one. Rendering nothing until we know would
  // leave the page blank for everybody, which is the worse trade.
  useEffect(() => {
    const existing = readDraft();
    if (existing) {
      setBasics({ name: existing.name, description: existing.description });
      setInitialAnswers(existing.answers);
    }
    setPersistent(storageAvailable());
  }, []);

  const save = (next: Basics, answers: InterviewAnswers) =>
    writeDraft({ version: GUEST_DRAFT_VERSION, ...next, answers });

  /* ── Step 1: the basics, mirroring /app/projects/new ──────────────────── */
  if (!basics) {
    return (
      <div className="mx-auto max-w-xl animate-slide-up px-6 py-16">
        <div className="flex items-center justify-between gap-4">
          <p className="font-mono text-xs text-fg-faint">Step 1 of 2 — the basics</p>
          <Progress value={50} aria-label="Setup progress" className="w-32" />
        </div>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-fg">What are you building?</h1>
        <p className="mt-2 text-base leading-relaxed text-fg-muted">
          A name and one honest paragraph. The CTO interview comes next — no account needed until
          you generate.
        </p>

        {!persistent ? (
          <p className="mt-5 rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg-muted">
            Your browser is blocking local storage, so your answers won&apos;t survive a reload.
            Finish in one sitting, or create an account first.
          </p>
        ) : null}
        {error ? <InlineError className="mt-5">{error}</InlineError> : null}

        <Card className="mt-6">
          <CardBody className="p-6">
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const parsed = projectCreateSchema.safeParse({
                  name: form.get("name"),
                  description: form.get("description")
                });
                if (!parsed.success) {
                  setError("A name (min 2 chars) and a description (min 10 chars) are required.");
                  return;
                }
                setError(null);
                save(parsed.data, initialAnswers);
                setBasics(parsed.data);
              }}
            >
              <div>
                <Label htmlFor="name">Project name</Label>
                <Input id="name" name="name" placeholder="e.g. Pied Piper" required autoFocus maxLength={80} />
              </div>
              <div>
                <Label htmlFor="description">What does it do, and for whom?</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={4}
                  required
                  maxLength={2000}
                  placeholder="e.g. A file compression platform that makes storage cheaper for anyone moving large amounts of data."
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="lg">
                  Continue to interview
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    );
  }

  /* ── Step 2: the interview itself ─────────────────────────────────────── */
  return (
    <InterviewRuntime
      projectName={basics.name}
      mode="guest"
      initialAnswers={initialAnswers}
      persist={(answers) => save(basics, answers)}
      submit={async (answers) => {
        // The wall. Persist first, then hand off to signup. The claim is triggered by
        // the draft's presence on the first signed-in load, not by a flag in the URL —
        // so it also survives an e-mail confirmation round-trip in the same browser.
        if (!save(basics, answers)) {
          return { error: "Your browser is blocking local storage, so we can't hold your answers." };
        }
        router.push("/signup");
      }}
      submitLabel="Log in or sign up to generate"
      pendingLabel="Taking you to signup…"
      back={{ href: "/", label: "Back to home" }}
    />
  );
}
