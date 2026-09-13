import { useEffect, useMemo, useState } from "react";

import type { TreeNode } from "../../../types/tree";

import { buildTreeMap } from "../../../utils/tree/buildTreeMap";
import { getAncestorIds } from "../../../utils/tree/getAncestorIds";
import { getTreePath } from "../../../utils/tree/getTreePath";

import { TreeSelectorNode } from "./TreeSelectorNode";

type Props<T extends TreeNode<T>> = {
  nodes: T[];

  selectedId: number | null;

  onSelect: (id: number | null) => void;

  emptyLabel: string;

  selectable?: (node: T) => boolean;

  clearLabel?: string;

  onSelected?: () => void;

  semanticTheme?: boolean;
};

export function TreeSelector<T extends TreeNode<T>>({
  nodes,
  selectedId,
  onSelect,
  emptyLabel,
  selectable,
  clearLabel,
  onSelected,
  semanticTheme = false,
}: Props<T>) {
  const nodeMap = useMemo(() => buildTreeMap(nodes), [nodes]);

  const selectedPath = getTreePath(selectedId, nodeMap, emptyLabel);

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // ================= AUTO EXPAND =================

  useEffect(() => {
    if (selectedId === null) return;

    const ancestorIds = getAncestorIds(selectedId, nodeMap);

    // Existing behavior intentionally expands the selected node's ancestors.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedIds((prev) => {
      const next = new Set(prev);

      ancestorIds.forEach((id) => next.add(id));

      return next;
    });
  }, [selectedId, nodeMap]);

  // ================= TOGGLE =================

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  function handleSelect(id: number | null) {
    onSelect(id);

    onSelected?.();
  }

  return (
    <div className={`rounded-xl border p-3 ${semanticTheme ? "border-border bg-control/40" : "border-gray-700 bg-gray-800/40"}`}>
      {/* CURRENT */}
      <div className="mb-3">
        <div className={`mb-1 text-xs uppercase tracking-wide ${semanticTheme ? "text-text-muted" : "text-gray-400"}`}>
          Selected
        </div>

        <div className={`break-words text-sm ${semanticTheme ? "text-text-secondary" : "text-gray-200"}`}>{selectedPath}</div>
      </div>

      {/* CLEAR */}
      {clearLabel && (
        <button
          type="button"
          onClick={() => handleSelect(null)}
          className={`w-full text-left px-2 py-1.5 rounded text-sm mb-2 ${
            selectedId === null
              ? "bg-blue-600/20 border border-blue-500/40"
              : semanticTheme ? "hover:bg-control" : "hover:bg-gray-800"
          }`}
        >
          {clearLabel}
        </button>
      )}

      {/* TREE */}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {nodes.map((node) => (
          <TreeSelectorNode
            key={node.id}
            node={node}
            level={0}
            selectedId={selectedId}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            onSelect={(id) => handleSelect(id)}
            selectable={selectable}
            semanticTheme={semanticTheme}
          />
        ))}
      </div>
    </div>
  );
}
