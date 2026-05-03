import { useMemo, useState } from "react";

import toast from "react-hot-toast";

import type { Category } from "../../types/category";

import {
  createCategory,
  deleteCategory,
  fetchCategories,
  updateCategory,
} from "../../api/categories";

import { CategoryTreeFlow } from "./category-tree/CategoryTreeFlow";

import { flattenCategories, findPathToNode } from "./category-tree/treeLayout";

type Props = {
  categories: Category[];

  onClose: () => void;

  onRefresh: (categories: Category[]) => void;
};

// ================= MOBILE TREE =================

function MobileTreeNode({
  node,
  level = 0,
}: {
  node: Category;

  level?: number;
}) {
  return (
    <div>
      <div
        className="
          bg-gray-900/40
          border border-gray-800
          rounded-xl
          px-3 py-3
          text-sm
        "
        style={{
          marginLeft: `${level * 14}px`,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="font-medium text-white truncate">{node.name}</div>

          <div className="text-xs text-gray-300 whitespace-nowrap">
            {node.stats.total_books} books
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3 text-[11px]">
          <div className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-200">
            Total: {node.stats.total_books}
          </div>

          <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-200">
            Read: {node.stats.read_books}
          </div>

          <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200">
            Unread: {node.stats.unread_books}
          </div>
        </div>
      </div>

      {node.children?.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <MobileTreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ================= COMPONENT =================

export function CategoryTreeModal({
  categories,

  onClose,

  onRefresh,
}: Props) {
  const flatCategories = useMemo(
    () => flattenCategories(categories),
    [categories],
  );

  const [focusedId, setFocusedId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  // ================= SEARCH =================

  const searchMatch = useMemo(() => {
    if (!search.trim()) return null;

    return flatCategories.find((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [flatCategories, search]);

  // ================= FOCUS =================

  const focusedPath = useMemo(() => {
    if (!focusedId) return [];

    return findPathToNode(categories, focusedId);
  }, [categories, focusedId]);

  // ================= REFRESH =================

  async function refreshTree() {
    const updated = await fetchCategories();

    onRefresh(updated);
  }

  // ================= RENAME =================

  async function handleRename(id: number, name: string) {
    await updateCategory(id, {
      name,
    });

    await refreshTree();

    toast.success("Category renamed");
  }

  // ================= CREATE CHILD =================

  async function handleAddChild(parentId: number, name: string) {
    await createCategory(name, parentId);

    await refreshTree();

    toast.success("Category created");
  }

  // ================= DELETE =================

  async function handleDelete(id: number, cascade = false) {
    const result = await deleteCategory(id, cascade);

    // CASCADE REQUIRED
    if (result?.blocked && !cascade) {
      return result;
    }

    await refreshTree();

    toast.success(cascade ? "Category tree deleted" : "Category deleted");

    return {
      success: true,
    };
  }

  return (
    <div
      className="
        absolute inset-0 z-30

        rounded-2xl

        border border-gray-800

        bg-gray-950/95

        backdrop-blur-sm

        overflow-hidden

        flex flex-col
      "
    >
      {/* HEADER */}
      <div
        className="
          border-b border-gray-800

          px-6 py-4

          bg-gray-900/80
        "
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Category Tree</h2>

            <p className="text-sm text-gray-400 mt-1">
              Interactive hierarchy explorer
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="
                w-64

                px-4 py-2

                rounded-xl

                bg-gray-900

                border border-gray-700

                text-sm

                focus:outline-none
                focus:border-purple-500
              "
            />

            <button
              onClick={onClose}
              className="
                px-4 py-2 rounded-xl

                bg-gray-800 hover:bg-gray-700

                border border-gray-700

                transition text-sm
              "
            >
              Close
            </button>
          </div>
        </div>

        {/* BREADCRUMB */}
        {focusedPath.length > 0 && (
          <div className="mt-4 text-sm text-gray-300">
            Focus:
            <span className="text-purple-300 ml-2">
              {focusedPath.join(" → ")}
            </span>
          </div>
        )}
      </div>

      {/* MOBILE */}
      <div className="lg:hidden flex-1 overflow-y-auto p-4">
        <div className="space-y-2">
          {categories.map((cat) => (
            <MobileTreeNode key={cat.id} node={cat} />
          ))}
        </div>
      </div>

      {/* DESKTOP */}
      <CategoryTreeFlow
        categories={categories}
        focusedId={focusedId}
        focusedPath={focusedPath}
        searchTargetId={searchMatch ? String(searchMatch.id) : null}
        onFocus={(id) => setFocusedId((prev) => (prev === id ? null : id))}
        onRename={handleRename}
        onAddChild={handleAddChild}
        onDelete={handleDelete}
      />
    </div>
  );
}
