import { useEffect, useState } from "react";

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

// ================= HELPERS =================

function renderCategoryOptions(
  categories: Category[],
  level = 0,
): JSX.Element[] {
  return categories.flatMap((cat) => [
    <option key={cat.id} value={cat.id}>
      {"— ".repeat(level)}
      {cat.name}
    </option>,

    ...(cat.children ? renderCategoryOptions(cat.children, level + 1) : []),
  ]);
}

// ================= TREE ITEM =================

function TreeItem({
  category,
  level = 0,
  onDelete,
}: {
  category: Category;

  level?: number;

  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div>
      <div
        className="
          flex items-center justify-between

          bg-gray-800/70
          hover:bg-gray-800

          border border-gray-700

          rounded-lg

          px-3 py-2

          transition
        "
        style={{
          marginLeft: `${level * 14}px`,
        }}
      >
        <button
          onClick={() => setExpanded((p) => !p)}
          className="
            flex items-center gap-2

            text-sm text-left

            flex-1
          "
        >
          <span className="text-gray-400 w-4">
            {category.children?.length ? (expanded ? "▼" : "▶") : ""}
          </span>

          <span>{category.name}</span>

          <span className="text-xs text-gray-500">
            ({category.stats.total_books})
          </span>
        </button>

        <button
          onClick={() => onDelete(category.id)}
          className="
            text-xs text-red-400
            hover:text-red-300
          "
        >
          Delete
        </button>
      </div>

      {expanded &&
        category.children?.map((child) => (
          <div key={child.id} className="mt-1">
            <TreeItem category={child} level={level + 1} onDelete={onDelete} />
          </div>
        ))}
    </div>
  );
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
  const [treeOpen, setTreeOpen] = useState(false);

  const [localCategories, setLocalCategories] = useState(categories);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  return (
    <div className="relative">
      {/* TREE OVERLAY */}
      {treeOpen && (
        <CategoryTreeModal
          categories={localCategories}
          onClose={() => setTreeOpen(false)}
          onRefresh={setLocalCategories}
        />
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* CREATE */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xl font-semibold mb-2">Create Category</h3>

          <p className="text-sm text-gray-400 mb-4">
            Select a parent category from the hierarchy.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs uppercase text-gray-500 block mb-2">
                Parent
              </label>

              <select
                value={categoryParentId}
                onChange={(e) =>
                  setCategoryParentId(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
                className="
                  w-full

                  px-4 py-3

                  rounded-lg

                  bg-gray-800

                  border border-gray-700
                "
              >
                <option value="">Top Level</option>

                {renderCategoryOptions(localCategories)}
              </select>
            </div>

            <div>
              <label className="text-xs uppercase text-gray-500 block mb-2">
                Category Name
              </label>

              <input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Fantasy, Philosophy, Sci-Fi..."
                className="
                  w-full

                  px-4 py-3

                  rounded-lg

                  bg-gray-800

                  border border-gray-700
                "
              />
            </div>

            <button
              onClick={onAddCategory}
              className="
                w-full

                py-3

                rounded-lg

                bg-gradient-to-r
                from-purple-600
                to-fuchsia-600

                hover:brightness-110

                transition
              "
            >
              Create Category
            </button>

            <button
              onClick={() => setCategoryParentId("")}
              className="
                w-full

                py-3

                rounded-lg

                bg-gray-800
                hover:bg-gray-700

                transition
              "
            >
              Create At Top Level
            </button>

            <button
              onClick={() => setTreeOpen(true)}
              className="
                w-full

                py-3

                rounded-lg

                bg-gray-800
                hover:bg-gray-700

                transition
              "
            >
              Expand Tree
            </button>
          </div>
        </div>

        {/* TREE */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xl font-semibold mb-2">Category Hierarchy</h3>

          <p className="text-sm text-gray-400 mb-4">
            Click a category to select where new categories should be created.
          </p>

          <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
            {localCategories.map((category) => (
              <TreeItem
                key={category.id}
                category={category}
                onDelete={onDeleteCategory}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
