import { BookOpen } from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";

export function SeriesBookTreeNode({ data }: Pick<NodeProps, "data">) {
  return (
    <div
      className={`relative flex h-10 w-[150px] items-center rounded-lg border bg-surface-raised/95 text-text-secondary shadow-sm transition hover:border-border-strong hover:bg-surface-muted ${
        data.selected ? "border-focus ring-2 ring-focus/70" : "border-border"
      }`}
      title={data.name}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <button
        type="button"
        onClick={data.onSelectBook}
        aria-pressed={data.selected}
        aria-label={`Select book ${data.name}`}
        className="flex h-full min-w-0 flex-1 items-center gap-2 px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
      >
        <span className="flex h-7 w-5 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted text-text-muted">
          {data.coverUrl ? (
            <img src={data.coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <BookOpen size={11} aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{data.name}</span>
      </button>
    </div>
  );
}
