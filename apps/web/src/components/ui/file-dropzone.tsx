"use client";

// A file field that looks like the rest of Airrow: click it or drop onto it, and see what you chose.
//
// The real <input type="file"> is still the form control — visually hidden, never replaced — so the
// browser builds exactly the same FormData it did before and `required` still guards the submit.
// Everything else here is affordance. The drop path hands the dropped FileList straight to that
// input, which is the only way a file can legally reach it; setting `files` fires no change event,
// so the selection is recorded explicitly alongside it.
import * as React from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, FileArchive, Upload, X } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

/** Empty, selected and error are states — not conditions sprinkled through the markup (§III). */
type DropzoneState =
  | { kind: "empty" }
  | { kind: "selected"; file: File }
  | { kind: "error"; message: string };

export interface FileDropzoneProps {
  /** Wires the caller's <Label htmlFor> to the input, and the click target to both. */
  id: string;
  name: string;
  accept?: string;
  required?: boolean;
  /** What the empty state invites you to do. */
  prompt: string;
  /** What one file is called here — "archive", "logo". Shapes the refusal copy. */
  noun?: string;
  /** Wired to the input through `aria-describedby`, so it is read with the field. */
  hint?: React.ReactNode;
  /** An error from outside, e.g. a rejected submit. Shown whenever no file is currently chosen. */
  error?: string;
  onFileChange?: (file: File | null) => void;
  className?: string;
}

const UNITS = ["B", "KB", "MB", "GB"] as const;

function fileSize(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // Whole bytes, one decimal above — "1.4 MB" tells you more than "1 MB" about a 50 MB limit.
  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`;
}

function acceptTokens(accept: string | undefined): string[] {
  return (accept ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter((token) => token !== "");
}

/** What `accept` does for the click path. A drop bypasses it, so the check is repeated by hand. */
function matchesAccept(file: File, accept: string | undefined): boolean {
  const tokens = acceptTokens(accept);
  if (tokens.length === 0) return true;
  const type = file.type.toLowerCase();
  return tokens.some((token) => {
    if (token.startsWith(".")) return file.name.toLowerCase().endsWith(token);
    if (token.endsWith("/*")) return type.startsWith(token.slice(0, -1));
    return type === token;
  });
}

/**
 * Why this drop cannot be taken, or null if it can. Refusing is an affordance, never a rule: the
 * server still validates everything it always did.
 */
function refuseDrop(files: FileList, accept: string | undefined, noun: string): string | null {
  if (files.length > 1) return `Drop one ${noun} at a time.`;
  const file = files[0];
  if (file === undefined || matchesAccept(file, accept)) return null;
  const extensions = acceptTokens(accept).filter((token) => token.startsWith("."));
  return extensions.length === 0
    ? `That ${noun} isn't accepted here.`
    : `That isn't a ${extensions.join(" or ")} ${noun}.`;
}

const carriesFiles = (event: React.DragEvent): boolean =>
  Array.from(event.dataTransfer.types).includes("Files");

export function FileDropzone({
  id,
  name,
  accept,
  required,
  prompt,
  noun = "file",
  hint,
  error,
  onFileChange,
  className
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  // Drags entering a child fire dragleave on the parent; counting depth keeps the zone from flickering.
  const depth = React.useRef(0);
  const hintId = `${id}-hint`;

  // React empties uncontrolled fields once a form action settles, and a file input cannot be
  // controlled — so the moment the submit ends, the file this control is naming is gone from the
  // form. That falling edge is the reset: watching the error text instead would miss the same
  // failure twice in a row (identical string, no change) and leave a phantom file on screen.
  // Adjusting state on a changed value during render, rather than in an effect.
  const { pending } = useFormStatus();
  const [submitting, setSubmitting] = React.useState(pending);
  if (pending !== submitting) {
    setSubmitting(pending);
    if (!pending) setFile(null);
  }

  function select(next: File | null, message: string | null) {
    setFile(next);
    setRefusal(message);
    onFileChange?.(next);
  }

  function clearInput() {
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    depth.current = 0;
    setDragging(false);

    const dropped = event.dataTransfer.files;
    const first = dropped[0];
    if (first === undefined) return;

    const message = refuseDrop(dropped, accept, noun);
    if (message !== null) {
      clearInput();
      select(null, message);
      return;
    }
    if (inputRef.current) inputRef.current.files = dropped;
    select(first, null);
  }

  // A refused drop is the freshest thing that happened; a chosen file outranks an error about the
  // last attempt, which is how the error clears itself once the founder picks again.
  const state: DropzoneState =
    refusal !== null
      ? { kind: "error", message: refusal }
      : file !== null
        ? { kind: "selected", file }
        : error !== undefined
          ? { kind: "error", message: error }
          : { kind: "empty" };

  return (
    <div
      className={className}
      onDragEnter={(event) => {
        if (!carriesFiles(event)) return;
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        // Without this the browser opens the file instead of letting it be dropped.
        if (carriesFiles(event)) event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (!carriesFiles(event)) return;
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="file"
        accept={accept}
        required={required}
        onChange={(event) => select(event.target.files?.[0] ?? null, null)}
        aria-describedby={hint ? hintId : undefined}
        className="peer sr-only"
      />

      <Zone
        state={state}
        htmlFor={id}
        prompt={prompt}
        dragging={dragging}
        onReplace={() => inputRef.current?.click()}
        onRemove={() => {
          clearInput();
          select(null, null);
        }}
      />

      {hint ? (
        <p id={hintId} className="mt-2 text-sm text-fg-faint">
          {hint}
        </p>
      ) : null}

      {/* The chosen file is visible above; this is how it reaches a screen reader when it changes. */}
      <p aria-live="polite" className="sr-only">
        {file ? `${file.name} selected` : ""}
      </p>
    </div>
  );
}

function Zone({
  state,
  htmlFor,
  prompt,
  dragging,
  onReplace,
  onRemove
}: {
  state: DropzoneState;
  htmlFor: string;
  prompt: string;
  dragging: boolean;
  onReplace: () => void;
  onRemove: () => void;
}) {
  switch (state.kind) {
    case "selected":
      return <SelectedZone file={state.file} dragging={dragging} onReplace={onReplace} onRemove={onRemove} />;
    case "error":
      return (
        <ChoiceZone
          htmlFor={htmlFor}
          dragging={dragging}
          tone="error"
          icon={<AlertTriangle className="size-5 text-danger" />}
          title={state.message}
          description="Choose it again, or drop it here."
        />
      );
    case "empty":
      return (
        <ChoiceZone
          htmlFor={htmlFor}
          dragging={dragging}
          tone="idle"
          icon={<Upload className="size-5 text-fg-faint" />}
          title={prompt}
          description="Drop it here, or click to browse."
        />
      );
  }
}

const zone =
  "flex flex-col items-center rounded-lg border border-dashed px-6 py-8 text-center transition-colors";

// The input is visually hidden but still the focusable control, so its focus has to show on the zone.
const focusRing =
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent";

/** Empty and error share a shape: nothing is chosen yet, and the whole zone asks for a file. */
function ChoiceZone({
  htmlFor,
  dragging,
  tone,
  icon,
  title,
  description
}: {
  htmlFor: string;
  dragging: boolean;
  tone: "idle" | "error";
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      // The label *is* the click target, so opening the picker stays the browser's job.
      role={tone === "error" ? "alert" : undefined}
      className={cn(
        zone,
        focusRing,
        "cursor-pointer",
        tone === "error"
          ? "border-danger/40 bg-danger/5 hover:bg-danger/10"
          : "border-border-strong bg-bg-subtle hover:border-accent hover:bg-surface",
        dragging && "border-accent bg-accent-soft"
      )}
    >
      {icon}
      <span className={cn("mt-3 text-base font-medium", tone === "error" ? "text-danger" : "text-fg")}>
        {title}
      </span>
      <span className="mt-1 text-sm text-fg-muted">{description}</span>
    </label>
  );
}

function SelectedZone({
  file,
  dragging,
  onReplace,
  onRemove
}: {
  file: File;
  dragging: boolean;
  onReplace: () => void;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border-strong bg-bg-subtle px-4 py-3 transition-colors",
        focusRing,
        dragging && "border-accent bg-accent-soft"
      )}
    >
      <FileArchive className="size-5 shrink-0 text-fg-muted" />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate text-base font-medium text-fg" title={file.name}>
          {file.name}
        </p>
        <p className="text-sm text-fg-faint">{fileSize(file.size)}</p>
      </div>
      <Button type="button" variant="secondary" size="sm" onClick={onReplace}>
        Replace
      </Button>
      <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${file.name}`} onClick={onRemove}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
