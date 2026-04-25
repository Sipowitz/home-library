import { useState } from "react";
import type { Category } from "../../api/categories";

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
  onDelete,
}: {
  node: Category;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="ml-2">
      <div className="flex items-center justify-between bg-gray-800 px-2 py-1 rounded">
        <div className="flex items-center gap-2">
          {node.children?.length > 0 && (
            <button
              onClick={() => setOpen(!open)}
              className="text-xs text-gray-400"
            >
              {open ? "▼" : "▶"}
            </button>
          )}
          <span className="text-gray-300">{node.name}</span>
        </div>

        <button
          onClick={() => onDelete(node.id)}
          className="text-red-400 text-xs"
        >
          Delete
        </button>
      </div>

      {open && node.children?.length > 0 && (
        <div className="ml-4 mt-1 space-y-1 border-l border-gray-700 pl-2">
          {node.children.map((child) => (
            <CategoryNode key={child.id} node={child} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategorySettings({
  categories,
  newCategory,
  setNewCategory,
  categoryParentId,
  setCategoryParentId,
  onAddCategory,
  onDeleteCategory,
}: Props) {
  return (
    <>
      {/* CATEGORIES */}
      <h3 className="text-lg mt-6 mb-2">Categories</h3>

      <input
        placeholder="New category name"
        className="w-full p-2 bg-gray-800 rounded mb-2"
        value={newCategory}
        onChange={(e) => setNewCategory(e.target.value)}
      />

      <select
        className="w-full p-2 bg-gray-800 rounded mb-2"
        value={categoryParentId}
        onChange={(e) =>
          setCategoryParentId(e.target.value ? Number(e.target.value) : "")
        }
      >
        <option value="">No parent</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      <button
        onClick={onAddCategory}
        className="bg-purple-600 w-full py-2 rounded mb-4"
      >
        Add Category
      </button>

      <div className="max-h-60 overflow-y-auto text-sm space-y-1">
        {categories.map((cat) => (
          <CategoryNode key={cat.id} node={cat} onDelete={onDeleteCategory} />
        ))}
      </div>
    </>
  );
}
