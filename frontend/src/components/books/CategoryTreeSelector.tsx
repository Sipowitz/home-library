import { useEffect, useMemo, useState } from "react";

import type { Category } from "../../types/category";

type Props = {
  categories: Category[];

  selectedCategoryId: number | null;

  onSelect: (id: number | null) => void;

  showSpecialOptions?: boolean;
};

type NodeProps = {
  category: Category;

  level: number;

  selectedCategoryId: number | null;

  expandedIds: Set<number>;

  toggleExpanded: (id: number) => void;

  onSelect: (id: number) => void;
};

// -------------------
// 🌲 BUILD CATEGORY MAP
// -------------------

function buildCategoryMap(
  categories: Category[],
  map = new Map<number, Category>(),
) {
  for (const category of categories) {
    map.set(category.id, category);

    if (category.children?.length) {
      buildCategoryMap(category.children, map);
    }
  }

  return map;
}

// -------------------
// 🌲 FIND PARENT PATH
// -------------------

function getAncestorIds(
  id: number | null,
  categoryMap: Map<number, Category>,
): number[] {
  if (id === null || id === -1) return [];

  const ancestors: number[] = [];

  let current = categoryMap.get(id);

  while (current?.parent_id != null) {
    ancestors.push(current.parent_id);
    current = categoryMap.get(current.parent_id);
  }

  return ancestors;
}

// -------------------
// 📍 CATEGORY PATH
// -------------------

function getCategoryPath(
  id: number | null,
  categoryMap: Map<number, Category>,
): string {
  if (id === null) return "None selected";
  if (id === -1) return "No category";

  const path: string[] = [];

  let current = categoryMap.get(id);

  while (current) {
    path.unshift(current.name);

    current =
      current.parent_id != null
        ? categoryMap.get(current.parent_id)
        : undefined;
  }

  return path.join(" > ");
}

// -------------------
// 🌿 TREE NODE
// -------------------

function CategoryTreeNode({
  category,
  level,
  selectedCategoryId,
  expandedIds,
  toggleExpanded,
  onSelect,
}: NodeProps) {
  const hasChildren = !!category.children?.length;

  const expanded = expandedIds.has(category.id);

  const isSelected = selectedCategoryId === category.id;

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
            onClick={() => toggleExpanded(category.id)}
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
          onClick={() => onSelect(category.id)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <div
            className={`w-3 h-3 rounded-full border flex-shrink-0 ${
              isSelected ? "bg-blue-500 border-blue-400" : "border-gray-500"
            }`}
          />

          <span className={isSelected ? "text-white" : "text-gray-300"}>
            {category.name}
          </span>
        </button>
      </div>

      {/* CHILDREN */}
      {expanded &&
        category.children?.map((child) => (
          <CategoryTreeNode
            key={child.id}
            category={child}
            level={level + 1}
            selectedCategoryId={selectedCategoryId}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

// -------------------
// 🌲 ROOT SELECTOR
// -------------------

export function CategoryTreeSelector({
  categories,
  selectedCategoryId,
  onSelect,
  showSpecialOptions = false,
}: Props) {
  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories]);

  const selectedPath = getCategoryPath(selectedCategoryId, categoryMap);

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // -------------------
  // 🌲 AUTO EXPAND SELECTED PATH
  // -------------------

  useEffect(() => {
    if (selectedCategoryId === null || selectedCategoryId === -1) return;

    const ancestorIds = getAncestorIds(selectedCategoryId, categoryMap);

    setExpandedIds((prev) => {
      const next = new Set(prev);
      ancestorIds.forEach((id) => next.add(id));
      return next;
    });
  }, [selectedCategoryId, categoryMap]);

  // -------------------
  // 🌲 TOGGLE
  // -------------------

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) next.delete(id);
      else next.add(id);

      return next;
    });
  }

  return (
    <div className="bg-gray-800/40 border border-gray-700 rounded-xl p-3">
      {/* CURRENT */}
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">
          Selected
        </div>

        <div className="text-sm text-gray-200 break-words">{selectedPath}</div>
      </div>

      {/* SPECIAL OPTIONS (only for search/filter mode) */}
      {showSpecialOptions && (
        <div className="mb-2 space-y-1">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${
              selectedCategoryId === null
                ? "bg-blue-600/20 border border-blue-500/40"
                : "hover:bg-gray-800"
            }`}
          >
            All categories
          </button>

          <button
            type="button"
            onClick={() => onSelect(-1)}
            className={`w-full text-left px-2 py-1.5 rounded text-sm ${
              selectedCategoryId === -1
                ? "bg-blue-600/20 border border-blue-500/40"
                : "hover:bg-gray-800"
            }`}
          >
            No category
          </button>
        </div>
      )}

      {/* TREE */}
      <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
        {categories.map((category) => (
          <CategoryTreeNode
            key={category.id}
            category={category}
            level={0}
            selectedCategoryId={selectedCategoryId}
            expandedIds={expandedIds}
            toggleExpanded={toggleExpanded}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}
