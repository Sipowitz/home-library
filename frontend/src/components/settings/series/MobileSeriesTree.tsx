import type { SeriesTreeNode } from "../../../types/series";

type Props = {
  nodes: SeriesTreeNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  level?: number;
};

export function MobileSeriesTree({ nodes, selectedId, onSelect, level = 0 }: Props) {
  return (
    <div className="space-y-1.5">
      {nodes.map((node) => (
        <div key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            aria-pressed={selectedId === node.id}
            className={`w-full rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 ${
              selectedId === node.id
                ? "border-focus bg-surface-raised text-text-primary"
                : "border-border bg-surface text-text-secondary hover:bg-surface-muted hover:text-text-primary"
            }`}
            style={{ paddingLeft: `${12 + Math.min(level, 8) * 12}px` }}
          >
            <span className="block break-words font-medium">{node.name}</span>
            <span className="mt-1 block text-xs text-text-muted">
              {node.children.length} {node.children.length === 1 ? "subseries" : "subseries"}
            </span>
          </button>
          {node.children.length > 0 && (
            <div className="mt-1 border-l border-border pl-1">
              <MobileSeriesTree
                nodes={node.children}
                selectedId={selectedId}
                onSelect={onSelect}
                level={level + 1}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
