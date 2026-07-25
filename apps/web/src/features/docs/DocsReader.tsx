"use client";

// Documentation reader for a generated project: searchable, collapsible nav on
// the left, rendered markdown on the right.
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, FileText, Search } from "lucide-react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { cn } from "@/lib/utils";

export interface DocFile {
  path: string;
  title: string;
  content: string;
}

/** Groups by the first path segment below the docs root, e.g. `architecture`. */
function groupOf(path: string): string {
  const parts = path.split("/");
  return parts.length > 2 ? (parts[1] ?? "General") : "General";
}

export function DocsReader({ docs }: { docs: DocFile[] }) {
  const [query, setQuery] = useState("");
  const [activePath, setActivePath] = useState(docs[0]?.path ?? "");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter(
      (d) => d.title.toLowerCase().includes(q) || d.content.toLowerCase().includes(q)
    );
  }, [docs, query]);

  const groups = useMemo(() => {
    const map = new Map<string, DocFile[]>();
    for (const doc of matches) {
      const g = groupOf(doc.path);
      map.set(g, [...(map.get(g) ?? []), doc]);
    }
    return [...map.entries()];
  }, [matches]);

  const active = docs.find((d) => d.path === activePath) ?? matches[0];

  const [html, setHtml] = useState("");
  useEffect(() => {
    if (!active) return;
    const raw = marked.parse(active.content, { async: false });
    setHtml(DOMPurify.sanitize(typeof raw === "string" ? raw : ""));
  }, [active]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const toggleGroup = (g: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="w-64 shrink-0 border-r border-border bg-bg-subtle p-3 max-md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-faint" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search docs"
            aria-label="Search documentation"
            className="h-8 pl-8 text-sm"
          />
        </div>

        <nav className="mt-3 space-y-1">
          {groups.map(([group, items]) => {
            const open = !collapsed.has(group);
            return (
              <div key={group}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group)}
                  aria-expanded={open}
                  className="flex w-full cursor-pointer items-center gap-1 rounded px-2 py-1 text-left text-2xs font-medium uppercase tracking-wide text-fg-faint transition-colors hover:text-fg"
                >
                  {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  {group}
                </button>
                {open
                  ? items.map((doc) => (
                      <button
                        key={doc.path}
                        type="button"
                        onClick={() => setActivePath(doc.path)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-1.5 rounded px-2 py-1 pl-6 text-left text-sm transition-colors",
                          doc.path === active?.path
                            ? "bg-accent-soft text-fg"
                            : "text-fg-muted hover:bg-surface hover:text-fg"
                        )}
                      >
                        <FileText className="size-3 shrink-0" />
                        <span className="truncate">{doc.title}</span>
                      </button>
                    ))
                  : null}
              </div>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        {active ? (
          <article className="mx-auto max-w-3xl px-6 py-10 md:px-10">
            <div className="mb-6 flex items-center justify-between gap-4">
              <p className="truncate font-mono text-xs text-fg-faint">{active.path}</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(active.content);
                  setCopied(true);
                }}
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg-muted transition-colors hover:border-border-strong hover:text-fg"
              >
                <Copy className="size-3" />
                {copied ? "Copied" : "Copy markdown"}
              </button>
            </div>
            <div className="prose-airrow" dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        ) : (
          <EmptyState
            className="m-8"
            title="Nothing matches that search"
            description="Try a different term, or clear the search to see every document."
          />
        )}
      </div>
    </div>
  );
}
