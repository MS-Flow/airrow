// The imported project's structure (spec 68). Shape only — names and sizes, never content.
//
// Paths come from the founder's archive and are untrusted, so they are rendered as text and React
// escapes them; nothing here goes near dangerouslySetInnerHTML. Directories use <details>, which
// gives collapse and keyboard access without any client JavaScript.
import { ChevronRight, File, Folder } from "lucide-react";
import type { FileTreeNode } from "@airrow/engine";

/** Sizes are for orientation, not accounting — one decimal is plenty. */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function TreeNode({ node }: { node: FileTreeNode }) {
  if (node.children === undefined) {
    return (
      <li className="flex items-center justify-between gap-3 py-1 pl-5">
        <span className="flex min-w-0 items-center gap-2">
          <File className="size-3.5 shrink-0 text-fg-faint" />
          <span className="truncate font-mono text-xs text-fg-muted">{node.name}</span>
        </span>
        <span className="shrink-0 font-mono text-2xs text-fg-faint">{formatBytes(node.bytes)}</span>
      </li>
    );
  }

  return (
    <li>
      <details className="group" open>
        <summary className="flex cursor-pointer items-center justify-between gap-3 rounded py-1 hover:bg-surface-raised">
          <span className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="size-3.5 shrink-0 text-fg-faint transition-transform group-open:rotate-90" />
            <Folder className="size-3.5 shrink-0 text-fg-faint" />
            <span className="truncate font-mono text-xs text-fg">{node.name}</span>
            <span className="shrink-0 text-2xs text-fg-faint">{node.children.length}</span>
          </span>
          <span className="shrink-0 font-mono text-2xs text-fg-faint">{formatBytes(node.bytes)}</span>
        </summary>
        <ul className="ml-2 border-l border-border pl-2">
          {node.children.map((child) => (
            <TreeNode key={child.path} node={child} />
          ))}
        </ul>
      </details>
    </li>
  );
}

export function ProjectTree({ nodes }: { nodes: FileTreeNode[] }) {
  if (nodes.length === 0) {
    return <p className="px-5 py-4 text-sm text-fg-muted">This import contained no files.</p>;
  }
  return (
    <ul className="px-5 py-3">
      {nodes.map((node) => (
        <TreeNode key={node.path} node={node} />
      ))}
    </ul>
  );
}
