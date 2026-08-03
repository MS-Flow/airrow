"use client";

// The import form needs the action's error text (limits, unreadable archive), which a redirect
// can't carry cleanly — hence useActionState rather than the plain <form action> used elsewhere.
//
// Name and description are controlled on purpose: React resets an uncontrolled form once the
// action returns, so after a rejected archive the founder would have found both fields wiped —
// and, since they are required, the form silently refused to submit again. Controlled values
// survive the reset. The file input can't be controlled (browsers forbid it), so it does clear;
// the dropzone is handed that error and shows it as its own state rather than leaving a
// required-but-empty field to explain itself.
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError, Notice } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { importProjectAction, type ImportFormState } from "./actions";
import { cacheArchive } from "./archive-cache";
import { ProPreview } from "./ProPreview";

export function ImportForm() {
  const [state, action] = useActionState<ImportFormState, FormData>(importProjectAction, {});
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [cacheWarning, setCacheWarning] = useState<string | null>(null);
  // Held in state, not read back off the input: React clears the field once the action returns.
  const [archive, setArchive] = useState<File | null>(null);
  const router = useRouter();

  // Once the import lands, keep the founder's archive in this browser before moving on — it is the
  // only remaining copy, and the merged download needs it. Navigation waits for that, so nothing
  // is lost by leaving the page. A quota failure is said out loud rather than discovered later.
  useEffect(() => {
    const projectId = state.projectId;
    if (projectId === undefined) return;

    let active = true;
    void (async () => {
      const result = archive ? await cacheArchive(projectId, archive) : { ok: false, reason: "no file" };
      if (!active) return;
      if (result.ok) {
        router.push(`/app/projects/${projectId}/interview`);
        return;
      }
      setCacheWarning(
        "Your archive was too large to keep in this browser, so the download will ask for it again. Everything else is imported."
      );
      setTimeout(() => router.push(`/app/projects/${projectId}/interview`), 4000);
    })();
    return () => {
      active = false;
    };
  }, [state.projectId, archive, router]);

  // The analysis ran and produced a real result; only keeping it needs Pro. Replacing the form
  // rather than sitting above it, because the form's next step no longer exists for this founder.
  if (state.requiresPro && state.preview) return <ProPreview preview={state.preview} />;

  return (
    <form action={action} className="space-y-5">
      {state.error ? <InlineError>{state.error}</InlineError> : null}
      {cacheWarning ? <Notice role="status">{cacheWarning}</Notice> : null}

      <div>
        <Label htmlFor="name">Project name</Label>
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Pied Piper"
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
          placeholder="e.g. A file compression platform that makes storage cheaper for anyone moving large amounts of data."
        />
      </div>

      <div>
        <Label htmlFor="archive">Your project as a .zip</Label>
        <FileDropzone
          id="archive"
          name="archive"
          accept=".zip,application/zip"
          required
          prompt="Drop your project here"
          noun="archive"
          error={state.error ? "Choose your archive again — the file field clears after an error." : undefined}
          onFileChange={setArchive}
          hint={
            <>
              Up to 50 MB and 5,000 files. <code className="font-mono text-2xs">node_modules</code>,{" "}
              <code className="font-mono text-2xs">.git</code>,{" "}
              <code className="font-mono text-2xs">dist</code> and{" "}
              <code className="font-mono text-2xs">.next</code> are skipped, so you don&rsquo;t have
              to clean up first.
            </>
          }
        />
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
