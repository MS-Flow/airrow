"use client";

// Repository preview (F-402): tree + rendered content, deep-linkable.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronRight, FileText, FolderTree, Pencil, X } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { InlineError } from "@/components/ui/states";
import { useOverlay } from "@/lib/use-overlay";
import { cn } from "@/lib/utils";
import { highlightFileAction, saveGeneratedFileAction } from "./actions";
import { resolvePreviewLink } from "./links";

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
  // Generated documents link to directories as well as files — `../specs/`, `../.claude/commands/`.
  // Those are real destinations in a repository, so they open the folder rather than doing nothing.
  const dirs = useMemo(() => {
    const s = new Set<string>();
    for (const f of files) {
      const parts = f.path.split("/");
      for (let i = 1; i < parts.length; i++) s.add(parts.slice(0, i).join("/"));
    }
    return s;
  }, [files]);

  // The active file is client state, not a URL read. Every file's content is already here, so a
  // switch is a re-render; routing to it made the server re-run auth, two queries and an artifact
  // load before anything appeared. The URL is still updated below so a link to a file keeps working.
  const requested = searchParams.get("file");
  const [active, setActive] = useState(() =>
    requested && byPath.has(requested) ? requested : "README.md"
  );

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

  const reader = useRef<HTMLDivElement>(null);

  // Below `md` the tree is an overlay drawer rather than a column, so a phone can reach the
  // repository at all. Above it the same markup is simply the pane it has always been, and
  // this state is never consulted.
  const [treeOpen, setTreeOpen] = useState(false);
  const closeTree = useCallback(() => setTreeOpen(false), []);
  useOverlay({ open: treeOpen, onDismiss: closeTree });

  const select = useCallback(
    (p: string) => {
      if (!byPath.has(p)) return;
      setActive(p);
      // Picking a file is the drawer's whole purpose, so it gets out of the way afterwards.
      setTreeOpen(false);
      // Deep links keep working without a navigation: no RSC round-trip, no scroll restoration.
      const params = new URLSearchParams(window.location.search);
      params.set("file", p);
      window.history.replaceState(null, "", `?${params.toString()}`);
      reader.current?.scrollTo({ top: 0 });
      // Below `md` the reader is not the scroll container — the page is, and a new file
      // should start at its first line rather than wherever the last one was left.
      window.scrollTo({ top: 0 });
    },
    [byPath]
  );

  const content = byPath.get(active) ?? "";
  const isMarkdown = active.endsWith(".md");
  const html = useMemo(() => {
    if (!isMarkdown) return "";
    const raw = marked.parse(content, { async: false });
    return DOMPurify.sanitize(typeof raw === "string" ? raw : "");
  }, [content, isMarkdown]);

  /**
   * A generated document is mostly links to its siblings, and rendered markdown gives them plain
   * relative hrefs — which the browser resolves against the *route*, landing on a 404. So clicks are
   * caught here and turned into a selection. A link to something the foundation does not contain does
   * nothing at all, which is the honest outcome: better a dead link than a 404 page.
   */
  const onReaderClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      const anchor = (e.target as HTMLElement).closest("a");
      const href = anchor?.getAttribute("href");
      if (!href) return;

      const link = resolvePreviewLink(active, href);
      if (link.kind === "external" || link.kind === "anchor") return;
      e.preventDefault();
      if (byPath.has(link.path)) {
        select(link.path);
        return;
      }
      if (dirs.has(link.path)) {
        setOpenSet((prev) => {
          const s = new Set(prev);
          const parts = link.path.split("/");
          for (let i = 1; i <= parts.length; i++) s.add(parts.slice(0, i).join("/"));
          return s;
        });
      }
    },
    [active, byPath, dirs, select]
  );

  // Highlighting is the one thing the client cannot do for itself. The server rendered the file the
  // page opened on; any other code file asks for it here and shows plain text until it arrives.
  const [fetched, setFetched] = useState<{ path: string; html: string } | null>(null);
  useEffect(() => {
    if (isMarkdown || highlightedFor === active) return;
    let live = true;
    void highlightFileAction(projectId, active).then((r) => {
      if (live && r.html) setFetched({ path: active, html: r.html });
    });
    return () => {
      live = false;
    };
  }, [active, isMarkdown, highlightedFor, projectId]);

  // Shiki's markup is built from untrusted file content, so it is sanitized here rather
  // than on the server — same point of injection, same sanitizer as the markdown above.
  const codeHtml = useMemo(() => {
    const raw =
      highlightedFor === active ? highlightedHtml : fetched?.path === active ? fetched.html : null;
    return raw ? DOMPurify.sanitize(raw) : null;
  }, [active, highlightedHtml, highlightedFor, fetched]);

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

  // From `md` up the tree and reader fill the viewport below the app top bar and preview
  // header, each scrolling on its own. Below it there is no such box: the preview header
  // wraps to three rows there, so any fixed height is a guess — and a nested scroll area on
  // a phone is a trap. The reader flows and the page scrolls.
  return (
    <div className="flex md:h-[calc(100dvh-7rem)]">
      {treeOpen ? (
        <button
          type="button"
          aria-label="Close file tree"
          onClick={closeTree}
          className="fixed inset-0 z-40 animate-fade-in cursor-default bg-bg/70 backdrop-blur-sm md:hidden"
        />
      ) : null}

      <aside
        id="preview-file-tree"
        className={cn(
          "w-72 shrink-0 border-r border-border bg-bg-subtle p-3 md:overflow-y-auto",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:overflow-y-auto max-md:transition-transform max-md:duration-200 max-md:ease-out-quart",
          treeOpen ? "max-md:translate-x-0" : "max-md:-translate-x-full"
        )}
      >
        <Dir dir={tree} depth={0} active={active} onSelect={select} openSet={openSet} toggle={toggle} />
      </aside>
      <div ref={reader} className="min-w-0 flex-1 md:overflow-y-auto">
        {/* The tree moves with the rail; the text does not. `.preview-reader` insets the
            column to wherever the viewport's centre is, so collapsing the rail leaves the
            file exactly where it was. */}
        <div className="preview-reader py-10">
          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {/* The way back to the repository on a phone; on desktop the tree is right there. */}
              <Button
                size="sm"
                variant="secondary"
                className="shrink-0 md:hidden"
                aria-expanded={treeOpen}
                aria-controls="preview-file-tree"
                onClick={() => setTreeOpen(true)}
              >
                <FolderTree className="size-3.5" />
                Files
              </Button>
              <p className="truncate font-mono text-xs text-fg-faint">{active}</p>
            </div>
            {editing ? (
              <div className="flex shrink-0 items-center gap-2">
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
              <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setDraft(content)}>
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
            // Delegated rather than bound per link: the anchors come from `dangerouslySetInnerHTML`,
            // so there is nothing to attach a handler to. Keyboard access is unaffected — the real
            // elements underneath are anchors, and Enter on a focused one fires this same click.
            <div
              className="prose-airrow"
              onClick={onReaderClick}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : codeHtml ? (
            <div
              className="overflow-x-auto rounded-lg border border-border text-sm leading-relaxed [&_pre]:p-4"
              dangerouslySetInnerHTML={{ __html: codeHtml }}
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
