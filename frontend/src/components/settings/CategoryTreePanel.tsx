import { useMemo, useState } from "react";

import toast from "react-hot-toast";

import type { Category } from "../../types/category";

import { useCategories } from "../../context/CategoryContext";

import { CategoryTreeFlow } from "./category-tree/CategoryTreeFlow";

import {
  flattenCategories,
  findPathIdsToNode,
  findPathToNode,
} from "./category-tree/treeLayout";

type Props = {
  categories: Category[];
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

export function CategoryTreePanel({ categories }: Props) {
  const { addCategory, editCategory, removeCategory } = useCategories();

  const flatCategories = useMemo(
    () => flattenCategories(categories),
    [categories],
  );

  const [focusedId, setFocusedId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  // ================= ROOT CREATE =================

  const [creatingRoot, setCreatingRoot] = useState(false);

  const [rootName, setRootName] = useState("");

  // ================= SEARCH =================

  const searchMatches = useMemo(() => {
    if (!search.trim()) return [];

    return flatCategories.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [flatCategories, search]);

  // ================= FOCUS =================

  const focusedPathIds = useMemo(() => {
    if (!focusedId) return [];

    return findPathIdsToNode(categories, focusedId);
  }, [categories, focusedId]);

  const focusedPath = useMemo(() => {
    if (!focusedId) return [];

    return findPathToNode(categories, focusedId);
  }, [categories, focusedId]);

  // ================= ROOT CREATE =================

  async function handleCreateRoot() {
    if (!rootName.trim()) {
      setCreatingRoot(false);

      setRootName("");

      return;
    }

    try {
      await addCategory(rootName.trim());

      toast.success("Root category created");

      setRootName("");

      setCreatingRoot(false);
    } catch (err) {
      console.error(err);

      toast.error("Failed to create category");
    }
  }

  // ================= RENAME =================

  async function handleRename(id: number, name: string) {
    try {
      await editCategory(id, {
        name,
      });

      toast.success("Category renamed");
    } catch (err) {
      console.error(err);

      toast.error("Failed to rename category");
    }
  }

  // ================= CREATE CHILD =================

  async function handleAddChild(parentId: number, name: string) {
    try {
      await addCategory(name, parentId);

      toast.success("Category created");
    } catch (err: any) {
      console.error(err);

      const message =
        err?.response?.data?.detail || "Failed to create category";

      toast.error(message);
    }
  }

  // ================= DELETE =================

  async function handleDelete(id: number, cascade = false) {
    const result = await removeCategory(id, cascade);

    if (result?.blocked && !cascade) {
      return result;
    }

    toast.success(cascade ? "Category tree deleted" : "Category deleted");

    return {
      success: true,
    };
  }

  return (
    <div className="h-full flex flex-col">
      {/* TOOLBAR */}
      <div
        className="
          border-b border-gray-800
          px-6 py-4
          bg-gray-950/40
          backdrop-blur-sm
        "
      >
        <div className="flex items-center justify-between gap-4">
          {/* LEFT */}
          <div className="flex items-center gap-3 flex-1">
            {/* SEARCH */}
            <div className="w-full max-w-md">
              <input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="
                  w-full
                  px-4 py-3
                  rounded-xl
                  bg-gray-900
                  border border-gray-700
                  text-sm
                  focus:outline-none
                  focus:border-purple-500
                "
              />
            </div>

            {/* ROOT CREATE */}
            {creatingRoot ? (
              <input
                autoFocus
                value={rootName}
                onChange={(e) => setRootName(e.target.value)}
                placeholder="Root category..."
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateRoot();
                  }

                  if (e.key === "Escape") {
                    setCreatingRoot(false);

                    setRootName("");
                  }
                }}
                className="
                  w-52
                  px-4 py-3
                  rounded-xl
                  bg-gray-900
                  border border-purple-500/40
                  text-sm
                  focus:outline-none
                "
              />
            ) : (
              <button
                onClick={() => setCreatingRoot(true)}
                className="
                  shrink-0
                  px-4 py-3
                  rounded-xl
                  bg-gradient-to-r
                  from-purple-600
                  to-fuchsia-600
                  hover:brightness-110
                  text-sm font-medium
                  transition
                "
              >
                + Root Category
              </button>
            )}

            {/* MATCH COUNT */}
            {search.trim() && (
              <div
                className="
                  px-3 py-2
                  rounded-xl
                  border border-purple-500/20
                  bg-purple-500/10
                  text-xs text-purple-200
                "
              >
                {searchMatches.length} matches
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-3">
            {/* ROOT COUNT */}
            <div
              className="
                px-3 py-2
                rounded-xl
                border border-gray-700
                bg-gray-900
                text-xs text-gray-300
              "
            >
              {categories.length} root categories
            </div>
          </div>
        </div>

        {/* FOCUS PATH */}
        {focusedPath.length > 0 && (
          <div className="mt-4 text-sm text-gray-400 truncate">
            <span className="text-gray-500">Focus:</span>

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
            <MobileTreeNode key={cat.id} node={cat} level={0} />
          ))}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:flex flex-1">
        <CategoryTreeFlow
          categories={categories}
          focusedId={focusedId}
          focusedPath={focusedPathIds}
          searchTargetId={searchMatches[0] ? String(searchMatches[0].id) : null}
          onFocus={(id) => {
            if (id === -1) {
              setFocusedId(null);

              return;
            }

            setFocusedId((prev) => (prev === id ? null : id));
          }}
          onRename={handleRename}
          onAddChild={handleAddChild}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
