import { useMemo, useState } from "react";

import type { Category } from "../../types/category";

import { CategoryTreeFlow } from "./category-tree/CategoryTreeFlow";

import {
  flattenCategories,
  findPathToNode,
} from "./category-tree/categoryTreeUtils";

type Props = {
  open: boolean;
  categories: Category[];
  onClose: () => void;
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
          backdrop-blur-sm
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

export function CategoryTreeModal({ open, categories, onClose }: Props) {
  const flatCategories = useMemo(
    () => flattenCategories(categories),
    [categories],
  );

  const [focusedId, setFocusedId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  const searchMatch = useMemo(() => {
    if (!search.trim()) return null;

    return flatCategories.find((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [flatCategories, search]);

  const focusedPath = useMemo(() => {
    if (!focusedId) return [];

    return findPathToNode(categories, focusedId);
  }, [categories, focusedId]);

  if (!open) return null;

  return (
    <div
      className="
        fixed inset-0 z-50
        bg-black/0
        backdrop-blur-[1px]
        flex items-center justify-center
        p-2 lg:p-4
      "
    >
      {/* MODAL */}
      <div
        className="
          w-full h-[95vh] lg:h-[85vh]
          lg:max-w-6xl
          rounded-2xl
          overflow-hidden
          flex flex-col
          border border-white/10
          bg-gray-950/20
          backdrop-blur-[6px]
          shadow-[0_0_40px_rgba(0,0,0,0.2)]
        "
      >
        {/* HEADER */}
        <div
          className="
            bg-gray-950/20
            border-b border-white/10
            px-6 py-4
            backdrop-blur-sm
          "
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Category Tree
              </h2>

              <p className="text-sm text-gray-300 mt-1">
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
                  bg-black/10
                  border border-white/10
                  text-sm
                  backdrop-blur-sm
                  focus:outline-none
                  focus:border-purple-500
                "
              />

              <button
                onClick={onClose}
                className="
                  px-4 py-2 rounded-xl
                  bg-black/10
                  hover:bg-black/20
                  border border-white/10
                  backdrop-blur-sm
                  transition text-sm
                "
              >
                Close
              </button>
            </div>
          </div>

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
        />
      </div>
    </div>
  );
}
