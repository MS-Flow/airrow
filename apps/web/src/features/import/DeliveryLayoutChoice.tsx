"use client";

// How the foundation lands (spec 187). Shown on the import review, after the analysis has proven
// there is a codebase to sit inside and before generation runs.
//
// Two modes, and the difference is what the founder's team sees — so the consequence is written
// next to each one rather than left to the label. Integrated stays the default and stays first: a
// founder who has not thought about this should get the behaviour Airrow has always had.
import { useActionState, useState } from "react";
import { RadioGroup, RadioItem } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlineError, Notice } from "@/components/ui/states";
import { SubmitButton } from "@/components/ui/submit-button";
import { setDeliveryLayoutAction, type LayoutFormState } from "./actions";

export function DeliveryLayoutChoice({
  projectId,
  current,
  folderPrefill,
  regenerateNeeded
}: {
  projectId: string;
  current: "integrated" | "hidden";
  /** The founder's own name, slugified — a starting point they can replace, never an imposition. */
  folderPrefill: string;
  /** True when an artifact already exists, so the choice only reaches the next generation. */
  regenerateNeeded: boolean;
}) {
  const [state, action] = useActionState<LayoutFormState, FormData>(setDeliveryLayoutAction, {});
  const [layout, setLayout] = useState(current);
  const [folder, setFolder] = useState(folderPrefill);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />
      {state.error ? <InlineError>{state.error}</InlineError> : null}
      {state.saved && regenerateNeeded ? (
        <Notice role="status">
          Saved. Your foundation was already generated in the other layout — regenerate it for this
          choice to take effect.
        </Notice>
      ) : null}

      <RadioGroup
        name="layout"
        value={layout}
        onValueChange={(next) => setLayout(next === "hidden" ? "hidden" : "integrated")}
        aria-label="How the foundation lands in your project"
        className="space-y-3"
      >
        <label
          htmlFor="layout-integrated"
          className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 hover:border-border-strong"
        >
          <RadioItem id="layout-integrated" value="integrated" className="mt-1" />
          <span>
            <span className="block text-sm font-medium text-fg">Integrated</span>
            <span className="mt-1 block text-sm text-fg-muted">
              Airrow&rsquo;s files take their own paths in your project, beside your own. Anything
              that collides with a file you already have becomes a conflict you decide. This is what
              you push, and what your team sees.
            </span>
          </span>
        </label>

        <label
          htmlFor="layout-hidden"
          className="flex cursor-pointer gap-3 rounded-lg border border-border p-4 hover:border-border-strong"
        >
          <RadioItem id="layout-hidden" value="hidden" className="mt-1" />
          <span>
            <span className="block text-sm font-medium text-fg">Hidden</span>
            <span className="mt-1 block text-sm text-fg-muted">
              Every file Airrow generates goes into one folder, and{" "}
              <code className="font-mono text-2xs">/cleanup</code> tells git to ignore it — in{" "}
              <code className="font-mono text-2xs">.git/info/exclude</code>, which is never pushed.
              Nothing collides, nothing is overwritten, and your repository&rsquo;s diff stays empty.
              No CI files are delivered: a workflow in an ignored folder could never run.
            </span>
          </span>
        </label>
      </RadioGroup>

      {layout === "hidden" ? (
        <div>
          <Label htmlFor="folder">Folder name</Label>
          <Input
            id="folder"
            name="folder"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            maxLength={48}
            required
            placeholder="notes"
          />
          <p className="mt-1.5 text-sm text-fg-faint">
            Lowercase letters, numbers and dashes. Yours is filled in — change it to whatever reads
            as ordinary in your repository.
          </p>
        </div>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
      </div>
    </form>
  );
}
