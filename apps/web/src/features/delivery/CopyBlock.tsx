"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyBlock({ text, mono = true }: { text: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="group relative mt-2 rounded-md border border-border bg-bg-subtle">
      <pre
        className={`overflow-x-auto p-3 pr-10 text-[13px] leading-relaxed text-fg ${mono ? "font-mono" : ""}`}
      >
        {text}
      </pre>
      <button
        type="button"
        aria-label="Copy to clipboard"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 cursor-pointer rounded p-1.5 text-fg-faint transition-colors hover:bg-surface hover:text-fg"
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
