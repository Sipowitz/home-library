import type { TreeNode } from "../../../types/tree";

type Props<T extends TreeNode<T>> = {
  node: T;

  level: number;

  selectedId: number | null;

  expandedIds: Set<number>;

  toggleExpanded: (id: number) => void;

  onSelect: (id: number) => void;

  selectable?: (node: T) => boolean;
};

export function TreeSelectorNode<T extends TreeNode<T>>({
  node,
  level,
  selectedId,
  expandedIds,
  toggleExpanded,
  onSelect,
  selectable,
}: Props<T>) {
  const hasChildren = !!node.children?.length;

  const expanded = expandedIds.has(node.id);

  const isSelected = selectedId === node.id;

  const canSelect = selectable ? selectable(node) : true;

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm transition ${
          isSelected
            ? "bg-blue-600/20 border border-blue-500/40"
            : "hover:bg-gray-800"
        }`}
        style={{
          paddingLeft: `${8 + level * 18}px`,
        }}
      >
        {/* EXPAND */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => toggleExpanded(node.id)}
            className="w-5 text-gray-400 hover:text-white flex-shrink-0"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <div className="w-5 flex-shrink-0" />
        )}

        {/* SELECT */}
        <button
          type="button"
          disabled={!canSelect}
          onClick={() => {
            if (!canSelect) return;

            onSelect(node.id);
          }}
          className={`flex items-center gap-2 flex-1 text-left ${
            canSelect ? "" : "cursor-default"
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full border flex-shrink-0 ${
              isSelected ? "bg-blue-500 border-blue-400" : "border-gray-500"
            }`}
          />

          <span
            className={
              canSelect
                ? isSelected
                  ? "text-white"
                  : "text-gray-300"
                : "text-gray-500 font-medium"
            }
          >
            {node.name}
          </span>
        </button>
      </div>

      {/* CHILDREN */}
      {expanded &&
        node.children?.map((child) => (
          <TreeSelectorNode
            key={child.id}
            node={child}
            level={level + 1}
            selectedId={selectedId}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            onSelect={onSelect}
            selectable={selectable}
          />
        ))}
    </div>
  );
}
