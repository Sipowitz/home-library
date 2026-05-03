// frontend/src/components/settings/CategorySettings.tsx

import { useMemo, useState } from "react";

import type { Category } from "../../types/category";

import { CategoryTreeModal } from "./CategoryTreeModal";

type Props = {
  categories: Category[];
  newCategory: string;
  setNewCategory: (v: string) => void;
  categoryParentId: number | "";
  setCategoryParentId: (v: number | "") => void;
  onAddCategory: () => void;
  onDeleteCategory: (id: number) => void;
};

// ================= CATEGORY NODE =================

function CategoryNode({
  node,
  selectedId,
  onSelect,
  onDelete,
}: {
  node: Category;
  selectedId: number | "";
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);

  const childCount = node.children?.length || 0;

  const selected = selectedId === node.id;

  return (
    <div className="ml-2">
      <div
        className={`
          flex items-center justify-between px-3 py-2 rounded transition
          ${
            selected
              ? "bg-purple-700/40 border border-purple-500"
              : "bg-gray-800 hover:bg-gray-750 border border-transparent"
          }
        `}
      >
        <button
          onClick={() => onSelect(node.id)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {childCount > 0 ? (
            <div
              onClick={(e) => {
                e.stopPropagation();

                setOpen(!open);
              }}
              className="text-xs text-gray-400 w-4 cursor-pointer"
            >
              {open ? "▼" : "▶"}
            </div>
          ) : (
            <div className="w-4" />
          )}

          <span className="text-gray-200">{node.name}</span>

          {childCount > 0 && (
            <span className="text-xs text-gray-500">({childCount})</span>
          )}
        </button>

        <button
          onClick={() => onDelete(node.id)}
          className="text-red-400 hover:text-red-300 text-xs ml-2"
        >
          Delete
        </button>
      </div>

      {open && childCount > 0 && (
        <div className="ml-5 mt-1 border-l border-gray-700 pl-2 space-y-1">
          {node.children.map((child) => (
            <CategoryNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ================= FIND PATH =================

function findCategoryPath(categories: Category[], targetId: number): string[] {
  for (const cat of categories) {
    if (cat.id === targetId) {
      return [cat.name];
    }

    if (cat.children?.length) {
      const childPath = findCategoryPath(cat.children, targetId);

      if (childPath.length) {
        return [cat.name, ...childPath];
      }
    }
  }

  return [];
}

// ================= COMPONENT =================

export function CategorySettings({
  categories,
  newCategory,
  setNewCategory,
  categoryParentId,
  setCategoryParentId,
  onAddCategory,
  onDeleteCategory,
}: Props) {
  const [showTree, setShowTree] = useState(false);

  const selectedPath = useMemo(() => {
    if (!categoryParentId) return "Top Level";

    return findCategoryPath(categories, Number(categoryParentId)).join(" > ");
  }, [categories, categoryParentId]);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        {/* CREATE PANEL */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 h-fit">
          <div className="mb-5">
            <h3 className="text-lg font-semibold">Create Category</h3>

            <p className="text-sm text-gray-400 mt-1">
              Select a parent category from the hierarchy.
            </p>
          </div>

          {/* SELECTED PARENT */}
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              Parent
            </div>

            <div className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 min-h-[42px] flex items-center">
              {selectedPath}
            </div>
          </div>

          {/* NAME */}
          <div className="mb-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
              Category Name
            </div>

            <input
              placeholder="Fantasy, Philosophy, Sci-Fi..."
              className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
          </div>

          {/* ACTIONS */}
          <div className="space-y-2">
            <button
              onClick={onAddCategory}
              className="
                bg-purple-600 hover:bg-purple-500
                transition w-full py-2 rounded
                font-medium
              "
            >
              Create Category
            </button>

            <button
              onClick={() => setCategoryParentId("")}
              className="
                bg-gray-800 hover:bg-gray-700
                transition w-full py-2 rounded text-sm
              "
            >
              Create At Top Level
            </button>

            <button
              onClick={() => setShowTree(true)}
              className="
                bg-gray-800 hover:bg-gray-700
                transition w-full py-2 rounded text-sm
              "
            >
              Expand Tree
            </button>
          </div>
        </div>

        {/* TREE */}
        <div className="border border-gray-800 rounded-xl p-4 bg-gray-950/40">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold">Category Hierarchy</h3>

              <p className="text-sm text-gray-400 mt-1">
                Click a category to select where new categories should be
                created.
              </p>
            </div>
          </div>

          <div className="max-h-[650px] overflow-y-auto space-y-1 pr-1">
            {categories.map((cat) => (
              <CategoryNode
                key={cat.id}
                node={cat}
                selectedId={categoryParentId}
                onSelect={(id) => setCategoryParentId(id)}
                onDelete={onDeleteCategory}
              />
            ))}
          </div>
        </div>
      </div>

      {/* TREE MODAL */}
      <CategoryTreeModal
        open={showTree}
        categories={categories}
        onClose={() => setShowTree(false)}
      />
    </>
  );
}
