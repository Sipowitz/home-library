// frontend/src/components/settings/categories/CategoryTreePanel.tsx

import { useMemo, useState } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import axios from "axios";

import toast from "react-hot-toast";

import type { Category } from "../../../types/category";

import { useCategories } from "../../../context/CategoryContext";

import { CategoryTreeFlow } from "./tree/CategoryTreeFlow";

import { TreeNodeActions } from "./tree/TreeNodeActions";

import {
  flattenTree,
  findPathIdsToNode,
  findPathToNode,
} from "../shared/treeLayout";

type Props = {
  categories: Category[];
};

// ================= MOBILE TREE =================

function MobileTreeNode({
  node,
  level = 0,
  onRename,
  onAddChild,
  onDelete,
}: {
  node: Category;

  level?: number;

  onRename: (id: number, name: string) => Promise<void>;

  onAddChild: (parentId: number, name: string) => Promise<void>;

  onDelete: (id: number, cascade?: boolean) => Promise<{
    blocked?: boolean;
    count?: number;
  } | undefined>;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [creatingChild, setCreatingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [cascadeCount, setCascadeCount] = useState<number | null>(null);

  async function handleRename() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setName(node.name);
      setEditing(false);
      return;
    }

    try {
      await onRename(node.id, trimmedName);
      setEditing(false);
    } catch {
      setName(node.name);
    }
  }

  async function handleCreateChild() {
    const trimmedName = childName.trim();

    if (!trimmedName) {
      setCreatingChild(false);
      setChildName("");
      return;
    }

    try {
      await onAddChild(node.id, trimmedName);
      setCreatingChild(false);
      setChildName("");
      setExpanded(true);
    } catch {
      // The shared handler already reports the error.
    }
  }

  async function handleDelete(cascade = false) {
    try {
      const result = await onDelete(node.id, cascade);

      if (result?.blocked && !cascade) {
        setCascadeCount(result.count ?? 0);
        return;
      }

      setConfirmingDelete(false);
      setCascadeCount(null);
    } catch {
      // The shared handler already reports the error.
    }
  }

  return (
    <div>
      <div
        className="
          relative
          bg-surface
          border border-border
          rounded-xl
          px-2 py-3
          text-sm
        "
        style={{
          marginLeft: `${level * 12}px`,
          width: `calc(100% - ${level * 12}px)`,
        }}
      >
        <div className="flex min-w-0 items-start gap-1">
          {hasChildren ? (
            <button
              type="button"
              aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
              aria-expanded={expanded}
              onClick={() => setExpanded((open) => !open)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-muted"
            >
              {expanded ? (
                <ChevronDown size={20} aria-hidden="true" />
              ) : (
                <ChevronRight size={20} aria-hidden="true" />
              )}
            </button>
          ) : (
            <div className="h-10 w-10 shrink-0" aria-hidden="true" />
          )}

          <div className="min-w-0 flex-1 pt-1">
            {editing ? (
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onBlur={handleRename}
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleRename();
                  if (event.key === "Escape") {
                    setName(node.name);
                    setEditing(false);
                  }
                }}
                className="form-control w-full rounded-lg px-2 py-1.5"
              />
            ) : (
              <div className="break-words font-medium text-text-primary">{node.name}</div>
            )}

            <div className="mt-1.5 text-xs leading-relaxed text-text-secondary">
              <span>{node.stats.total_books} books</span>
              <span aria-hidden="true"> · </span>
              <span>{node.stats.read_books} read</span>
              <span aria-hidden="true"> · </span>
              <span>{node.stats.unread_books} unread</span>
            </div>
          </div>

          <TreeNodeActions
            label={node.name}
            onAdd={() => setCreatingChild(true)}
            onEdit={() => setEditing(true)}
            onDelete={() => setConfirmingDelete(true)}
          />
        </div>

        {creatingChild && (
          <div className="mt-3 pl-11">
            <input
              autoFocus
              value={childName}
              onChange={(event) => setChildName(event.target.value)}
              placeholder="New child category..."
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreateChild();
                if (event.key === "Escape") {
                  setCreatingChild(false);
                  setChildName("");
                }
              }}
              className="form-control w-full rounded-lg px-3 py-2"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreatingChild(false);
                  setChildName("");
                }}
                className="flex-1 rounded-lg bg-control px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Create child category"
                onClick={handleCreateChild}
                disabled={!childName.trim()}
                className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {confirmingDelete && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <div className="text-sm text-danger">
              {cascadeCount === null
                ? "Delete this category?"
                : `Delete this category and ${cascadeCount} descendants?`}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  setCascadeCount(null);
                }}
                className="flex-1 rounded-lg bg-control px-3 py-2 text-text-secondary hover:bg-surface-raised"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(cascadeCount !== null)}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-white"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 space-y-1">
          {node.children?.map((child: Category) => (
            <MobileTreeNode
              key={child.id}
              node={child}
              level={level + 1}
              onRename={onRename}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ================= COMPONENT =================

export function CategoryTreePanel({ categories }: Props) {
  const { addCategory, editCategory, removeCategory } = useCategories();

  const flatCategories = useMemo(() => flattenTree(categories), [categories]);

  const [focusedId, setFocusedId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  // ================= ROOT CREATE =================

  const [creatingRoot, setCreatingRoot] = useState(false);

  const [rootName, setRootName] = useState("");

  // ================= SEARCH =================

  const searchMatches = useMemo(() => {
    if (!search.trim()) return [];

    return flatCategories.filter((c: Category) =>
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
      throw err;
    }
  }

  // ================= CREATE CHILD =================

  async function handleAddChild(parentId: number, name: string) {
    try {
      await addCategory(name, parentId);

      toast.success("Category created");
    } catch (err: unknown) {
      console.error(err);

      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      toast.error(typeof detail === "string" ? detail : "Failed to create category");
      throw err;
    }
  }

  // ================= DELETE =================

  async function handleDelete(id: number, cascade = false) {
    try {
      const result = await removeCategory(id, cascade);

      if (result?.blocked && !cascade) {
        return result;
      }

      if (!result?.success) {
        throw new Error(result?.message || "Failed to delete category");
      }

      toast.success(cascade ? "Category tree deleted" : "Category deleted");
      return { success: true };
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to delete category");
      throw err;
    }
  }

  return (
    <div className="flex flex-col">
      {/* TOOLBAR */}
      <div
        className="
          border-b border-border
          px-2.5 py-3 sm:px-4 lg:px-6 lg:py-4
          bg-surface/40
          backdrop-blur-sm
        "
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          {/* LEFT */}
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:flex-1">
            {/* SEARCH */}
            <div className="w-full lg:max-w-md lg:flex-1">
              <input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="
                  w-full
                  px-4 py-3
                  form-control rounded-xl
                  text-sm
                "
              />
            </div>

            {/* ROOT CREATE */}
            {creatingRoot ? (
              <div className="flex w-full flex-col gap-2 sm:w-auto">
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
                  w-full sm:w-52
                  px-4 py-3
                  form-control rounded-xl
                  text-sm
                "
                />
                <div className="flex gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingRoot(false);
                      setRootName("");
                    }}
                    className="flex-1 rounded-lg bg-control px-3 py-2 text-sm text-text-secondary hover:bg-surface-raised"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    aria-label="Create root category"
                    onClick={handleCreateRoot}
                    disabled={!rootName.trim()}
                    className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
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
                  text-sm font-medium text-white
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
                  text-xs text-purple-700 dark:text-purple-200
                "
              >
                {searchMatches.length} matches
              </div>
            )}
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2 self-start lg:gap-3 lg:self-auto">
            {/* ROOT COUNT */}
            <div
              className="
                px-3 py-2
                rounded-xl
                border border-border-strong
                bg-surface-muted
                text-xs text-text-secondary
              "
            >
              <span className="sm:hidden">{categories.length} roots</span>
              <span className="hidden sm:inline">{categories.length} root categories</span>
            </div>
          </div>
        </div>

        {/* FOCUS PATH */}
        {focusedPath.length > 0 && (
          <div className="mt-4 text-sm text-text-muted truncate">
            <span className="text-text-muted">Focus:</span>

            <span className="text-purple-700 dark:text-purple-300 ml-2">
              {focusedPath.join(" → ")}
            </span>
          </div>
        )}
      </div>

      {/* MOBILE */}
      <div className="lg:hidden px-1.5 py-2 sm:p-3">
        <div className="space-y-2">
          {categories.map((cat: Category) => (
            <MobileTreeNode
              key={cat.id}
              node={cat}
              level={0}
              onRename={handleRename}
              onAddChild={handleAddChild}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden h-[70vh] lg:flex">
        <CategoryTreeFlow
          categories={categories}
          focusedId={focusedId}
          focusedPath={focusedPathIds}
          searchTargetId={searchMatches[0] ? String(searchMatches[0].id) : null}
          onFocus={(id: number) => {
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
