import { Handle, Position, type NodeProps } from "reactflow";

import { GitBranch } from "lucide-react";

import { getDepthStyles } from "../categories/tree/treeStyles";

export function SeriesTreeNode({ data }: NodeProps) {
  const styles = getDepthStyles(data.depth);

  return (
    <div
      className={`min-w-[260px] rounded-2xl border bg-gradient-to-b transition ${styles.border} ${styles.bg} ${
        data.dimmed ? "opacity-50" : "opacity-100"
      } ${data.selected ? "ring-2 ring-focus/70" : ""}`}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <button
        type="button"
        onClick={() => data.onFocus(data.id)}
        aria-pressed={data.selected}
        aria-label={`Select Series ${data.name}`}
        className="w-full rounded-2xl px-5 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg border border-border bg-surface-muted p-2 text-text-secondary">
            <GitBranch size={17} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold text-text-primary" title={data.name}>
              {data.name}
            </div>
            <div className="mt-2 text-xs text-text-muted">
              {data.childCount} {data.childCount === 1 ? "subseries" : "subseries"}
            </div>
          </div>
        </div>
      </button>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
