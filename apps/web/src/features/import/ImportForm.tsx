"use client";

// The import form needs the action's error text (limits, unreadable archive), which a redirect
// can't carry cleanly — hence useActionState rather than the plain <form action> used elsewhere.
//
// Name and description are controlled on purpose: React resets an uncontrolled form once the
// action returns, so after a rejected archive the founder would have found both fields wiped —
// and, since they are required, the form silently refused to submit again. Controlled values
// survive the reset. The file input can't be controlled (browsers forbid it), so it does clear;
// the hint below says so rather than leaving a required-but-empty field to explain itself.
import { useActionState, useState } from "react";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { importProjectAction, type ImportFormState } from "./actions";

export function ImportForm() {
  const [state, action] = useActionState<ImportFormState, FormData>(importProjectAction, {});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  return (
    <form action={action} className="space-y-5">
      {state.error ? <InlineError>{state.error}</InlineError> : null}

      <div>
        <Label htmlFor="name">Project name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Loop CRM"
          required
          autoFocus
          maxLength={80}
        />
      </div>

      <div>
        <Label htmlFor="description">What does it do, and for whom?</Label>
        <Textarea
          id="description"
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          required
          maxLength={2000}
          placeholder="e.g. A lightweight CRM that helps small agencies track client relationships."
        />
      </div>

      <div>
        <Label htmlFor="archive">Your project as a .zip</Label>
        <Input id="archive" name="archive" type="file" accept=".zip,application/zip" required />
        {state.error ? (
          <p className="mt-2 text-sm text-fg-muted">Choose your archive again — the file field clears after an error.</p>
        ) : null}
        <p className="mt-2 text-sm text-fg-faint">
          Up to 50 MB and 5,000 files. <code className="font-mono text-2xs">node_modules</code>,{" "}
          <code className="font-mono text-2xs">.git</code>,{" "}
          <code className="font-mono text-2xs">dist</code> and{" "}
          <code className="font-mono text-2xs">.next</code> are skipped, so you don&rsquo;t have to
          clean up first.
        </p>
      </div>

      <input type="hidden" name="source" value="zip" />

      <div className="flex justify-end">
        <SubmitButton size="lg" pendingLabel="Analysing…">
          Analyse and continue
        </SubmitButton>
      </div>
    </form>
  );
}
