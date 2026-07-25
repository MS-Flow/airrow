"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: string;
}

/**
 * ⌘K palette. Radix Dialog supplies the focus trap, scroll lock and Esc; the
 * list is a roving-focus listbox driven from the input, so the caret never
 * leaves the query field.
 */
export function CommandPalette({ items }: { items: CommandItem[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Any change to the result set puts the cursor back on the first row.
  React.useEffect(() => setActive(0), [query]);

  const run = React.useCallback(
    (item: CommandItem | undefined) => {
      if (!item) return;
      setOpen(false);
      setQuery("");
      router.push(item.href);
    },
    [router]
  );

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (matches.length === 0 ? 0 : (i + 1) % matches.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (matches.length === 0 ? 0 : (i - 1 + matches.length) % matches.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run(matches[active]);
    }
  };

  let lastGroup = "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 animate-fade-in bg-bg/70 backdrop-blur-sm" />
        <DialogPrimitive.Content
          aria-label="Command palette"
          className="fixed left-1/2 top-[15vh] z-50 w-full max-w-xl -translate-x-1/2 animate-scale-in overflow-hidden rounded-xl border border-border bg-surface shadow-e3 focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Command palette</DialogPrimitive.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="size-4 shrink-0 text-fg-faint" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Jump to a project or screen…"
              aria-label="Search commands"
              aria-activedescendant={matches[active] ? `command-${matches[active].id}` : undefined}
              className="h-12 w-full bg-transparent text-md text-fg placeholder:text-fg-faint focus:outline-none"
            />
            <kbd className="shrink-0 rounded border border-border bg-bg-subtle px-1.5 py-0.5 font-mono text-2xs text-fg-faint">
              esc
            </kbd>
          </div>

          <div role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-2">
            {matches.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-fg-faint">
                Nothing matches “{query}”.
              </p>
            ) : (
              matches.map((item, i) => {
                const newGroup = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <React.Fragment key={item.id}>
                    {newGroup ? (
                      <p className="px-3 pb-1 pt-3 text-2xs font-medium uppercase tracking-wide text-fg-faint">
                        {item.group}
                      </p>
                    ) : null}
                    <button
                      id={`command-${item.id}`}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(item)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors",
                        i === active ? "bg-surface-raised text-fg" : "text-fg-muted"
                      )}
                    >
                      <span className="truncate text-base">{item.label}</span>
                      {item.hint ? (
                        <span className="shrink-0 font-mono text-2xs text-fg-faint">{item.hint}</span>
                      ) : null}
                    </button>
                  </React.Fragment>
                );
              })
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
