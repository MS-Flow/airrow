"use client";

// Repository preview (F-402): tree + rendered content, deep-linkable.
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronRight, FileText, Pencil, X } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { cn } from "@/lib/utils";
import { saveGeneratedFileAction } from "./actions";

export interface PreviewFile {
  path: string;
  content: string;
}

interface TreeDir {
  name: string;
  path: string;
  dirs: TreeDir[];
  files: Array<{ name: string; path: string }>;
}

function buildTree(files: PreviewFile[]): TreeDir {
  const root: TreeDir = { name: "", path: "", dirs: [], files: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i] ?? "";
      const p = parts.slice(0, i + 1).join("/");
      let child = node.dirs.find((d) => d.path === p);
      if (!child) {
        child = { name: seg, path: p, dirs: [], files: [] };
        node.dirs.push(child);
      }
      node = child;
    }
    node.files.push({ name: parts[parts.length - 1] ?? f.path, path: f.path });
  }
  const sortNode = (n: TreeDir): void => {
    n.dirs.sort((a, b) => a.name.localeCompare(b.name));
    n.files.sort((a, b) => a.name.localeCompare(b.name));
    n.dirs.forEach(sortNode);
  };
  sortNode(root);
  return root;
}

function Dir({
  dir,
  depth,
  active,
  onSelect,
  openSet,
  toggle
}: {
  dir: TreeDir;
  depth: number;
  active: string;
  onSelect: (p: string) => void;
  openSet: Set<string>;
  toggle: (p: string) => void;
}) {
  const open = openSet.has(dir.path);
  return (
    <div>
      {dir.name ? (
        <button
          type="button"
          onClick={() => toggle(dir.path)}
          className="flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1 text-left font-mono text-sm text-fg-muted transition-colors hover:text-fg"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {open ? <ChevronDown className="size-3 shrink-0" /> : <ChevronRight className="size-3 shrink-0" />}
          {dir.name}/
        </button>
      ) : null}
      {open || !dir.name ? (
        <div>
          {dir.dirs.map((d) => (
            <Dir key={d.path} dir={d} depth={depth + 1} active={active} onSelect={onSelect} openSet={openSet} toggle={toggle} />
          ))}
          {dir.files.map((f) => (
            <button
              key={f.path}
              type="button"
              onClick={() => onSelect(f.path)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-left font-mono text-sm transition-colors",
                active === f.path ? "bg-accent-soft text-fg" : "text-fg-muted hover:bg-surface hover:text-fg"
              )}
              style={{ paddingLeft: `${(depth + (dir.name ? 1 : 0)) * 12 + 8}px` }}
            >
              <FileText className="size-3 shrink-0" />
              {f.name}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function PreviewBrowser({
  files,
  projectId,
  highlightedHtml,
  highlightedFor
}: {
  files: PreviewFile[];
  projectId: string;
  /** Server-highlighted HTML for the active code file; sanitized here before injection. */
  highlightedHtml: string | null;
  /** The path `highlightedHtml` belongs to — stale markup is never rendered. */
  highlightedFor: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const byPath = useMemo(() => new Map(files.map((f) => [f.path, f.content])), [files]);
  const tree = useMemo(() => buildTree(files), [files]);

  const requested = searchParams.get("file");
  const active = requested && byPath.has(requested) ? requested : "README.md";

  const [openSet, setOpenSet] = useState<Set<string>>(() => {
    const s = new Set<string>();
    active.split("/").slice(0, -1).forEach((_, i, arr) => s.add(arr.slice(0, i + 1).join("/")));
    return s;
  });

  useEffect(() => {
    setOpenSet((prev) => {
      const s = new Set(prev);
      active.split("/").slice(0, -1).forEach((_, i, arr) => s.add(arr.slice(0, i + 1).join("/")));
      return s;
    });
  }, [active]);

  const toggle = useCallback((p: string) => {
    setOpenSet((prev) => {
      const s = new Set(prev);
      if (s.has(p)) s.delete(p);
      else s.add(p);
      return s;
    });
  }, []);

  const select = useCallback(
    (p: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("file", p);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const content = byPath.get(active) ?? "";
  const isMarkdown = active.endsWith(".md");
  const [html, setHtml] = useState("");

  // Shiki's markup is built from untrusted file content, so it is sanitized here rather
  // than on the server — same point of injection, same sanitizer as the markdown above.
  const safeHighlighted = useMemo(
    () => (highlightedHtml ? DOMPurify.sanitize(highlightedHtml) : null),
    [highlightedHtml]
  );

  useEffect(() => {
    if (!isMarkdown) return;
    const raw = marked.parse(content, { async: false });
    setHtml(DOMPurify.sanitize(typeof raw === "string" ? raw : ""));
  }, [content, isMarkdown]);

  // ── Editing ───────────────────────────────────────────────────────────────
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const editing = draft !== null;

  // Switching files always leaves edit mode — a draft belongs to the file it was opened on.
  useEffect(() => {
    setDraft(null);
    setError(null);
  }, [active]);

  const save = useCallback(() => {
    if (draft === null) return;
    startSaving(async () => {
      const result = await saveGeneratedFileAction(projectId, active, draft);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(null);
      setError(null);
      router.refresh();
    });
  }, [active, draft, projectId, router]);

  // The tree and reader fill the viewport below the app top bar and preview header.
  return (
    <div className="flex h-[calc(100vh-7rem)]">
      <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-bg-subtle p-3 max-md:hidden">
        <Dir dir={tree} depth={0} active={active} onSelect={select} openSet={openSet} toggle={toggle} />
      </aside>
      <div className="flex-1 overflow-y-auto">
        {/* The tree moves with the rail; the text does not. `.preview-reader` insets the
            column to wherever the viewport's centre is, so collapsing the rail leaves the
            file exactly where it was. */}
        <div className="preview-reader py-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <p className="font-mono text-xs text-fg-faint">{active}</p>
            {editing ? (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                  <X className="size-3.5" />
                  Cancel
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  <Check className="size-3.5" />
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => setDraft(content)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            )}
          </div>

          {error ? <InlineError className="mb-4">{error}</InlineError> : null}

          {editing ? (
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              spellCheck={false}
              className="h-[60vh] w-full resize-y rounded-lg border border-border bg-bg-subtle p-4 font-mono text-sm leading-relaxed text-fg outline-none focus:border-accent"
            />
          ) : isMarkdown ? (
            <div className="prose-airrow" dangerouslySetInnerHTML={{ __html: html }} />
          ) : highlightedFor === active && safeHighlighted ? (
            <div
              className="overflow-x-auto rounded-lg border border-border text-sm leading-relaxed [&_pre]:p-4"
              dangerouslySetInnerHTML={{ __html: safeHighlighted }}
            />
          ) : (
            <pre className="overflow-x-auto rounded-lg border border-border bg-bg-subtle p-4 font-mono text-sm leading-relaxed text-fg">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
