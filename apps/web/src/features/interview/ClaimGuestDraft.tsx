"use client";

// Bridges the signed-out interview into the account. Mounted in the app shell, so it
// runs on the first authenticated load — whether that happens straight after signup or
// days later via an e-mail confirmation link, as long as it's the same browser.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { claimGuestDraftAction } from "./claim-action";
import { clearDraft, readDraft } from "./draft";

export function ClaimGuestDraft() {
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  // StrictMode double-invokes effects in dev; claiming twice would create two projects.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const draft = readDraft();
    if (!draft) return;
    started.current = true;
    setClaiming(true);

    void (async () => {
      const result = await claimGuestDraftAction(draft);
      // Either way the draft is spent: on success it's a project now, and on failure
      // it would only fail again on every load.
      clearDraft();
      setClaiming(false);
      if (result.ok) {
        router.replace(`/app/projects/${result.projectId}/interview`);
        router.refresh();
      }
    })();
  }, [router]);

  if (!claiming) return null;

  return (
    <div
      role="status"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg/80 backdrop-blur-sm"
    >
      <Spinner />
      <p className="text-sm text-fg-muted">Adding your interview to your account…</p>
    </div>
  );
}
