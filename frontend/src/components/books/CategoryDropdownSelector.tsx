import { useEffect, useMemo, useRef, useState } from "react";

import type { Category } from "../../types/category";

type Props = {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelect: (id: number) => void;
};

type NodeProps = {
  category: Category;
  level: number;
  selectedCategoryId: number | null;
  onSelect: (id: number) => void;
};

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

function getCategoryPath(
  id: number | null,
  categoryMap: Map<number, Category>,
): string {
  if (!id) return "Select category";

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

function CategoryNode({
  category,
  level,
  selectedCategoryId,
  onSelect,
}: NodeProps) {
  const hasChildren = !!category.children?.length;

  const [expanded, setExpanded] = useState(level < 1);

  const isSelected = selectedCategoryId === category.id;

  return (
    <div>
      <div
        className={`flex items-center gap-2 px-2 py-1 rounded text-sm ${
          isSelected ? "bg-blue-600/30" : "hover:bg-gray-700"
        }`}
        style={{
          paddingLeft: `${8 + level * 16}px`,
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="w-5 text-gray-400 hover:text-white"
          >
            {expanded ? "▾" : "▸"}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <button
          type="button"
          onClick={() => onSelect(category.id)}
          className="flex-1 text-left"
        >
          {category.name}
        </button>
      </div>

      {expanded &&
        category.children?.map((child) => (
          <CategoryNode
            key={child.id}
            category={child}
            level={level + 1}
            selectedCategoryId={selectedCategoryId}
            onSelect={onSelect}
          />
        ))}
    </div>
  );
}

export function CategoryDropdownSelector({
  categories,
  selectedCategoryId,
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories]);

  const selectedLabel = getCategoryPath(selectedCategoryId, categoryMap);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full p-2 bg-gray-700 rounded flex justify-between items-center"
      >
        <span className="truncate">{selectedLabel}</span>

        <span>{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full bg-gray-800 rounded shadow
          border border-gray-700 max-h-72 overflow-y-auto"
        >
          {categories.map((category) => (
            <CategoryNode
              key={category.id}
              category={category}
              level={0}
              selectedCategoryId={selectedCategoryId}
              onSelect={(id) => {
                onSelect(id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
