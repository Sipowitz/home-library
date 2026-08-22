// frontend/src/components/settings/locations/LocationTreePanel.tsx

import { useMemo, useState } from "react";

import { ChevronDown, ChevronRight } from "lucide-react";

import toast from "react-hot-toast";

import type { Location } from "../../../types/location";

import { useLocations } from "../../../context/LocationContext";

import { LocationTreeFlow } from "./tree/LocationTreeFlow";

import { TreeNodeActions } from "../categories/tree/TreeNodeActions";

import {
  flattenTree,
  findPathIdsToNode,
  findPathToNode,
} from "../shared/treeLayout";

type Props = {
  locations: Location[];
};

// ================= MOBILE TREE =================

function MobileTreeNode({
  node,
  level = 0,
  onRename,
  onAddChild,
  onDelete,
}: {
  node: Location;

  level?: number;

  onRename: (id: number, name: string) => Promise<void>;

  onAddChild: (parentId: number, name: string) => Promise<void>;

  onDelete: (id: number) => Promise<void>;
}) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(node.name);
  const [creatingChild, setCreatingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleRename() {
    const trimmedName = name.trim();

    if (!trimmedName) {
      setName(node.name);
      setEditing(false);
      return;
    }

    await onRename(node.id, trimmedName);
    setEditing(false);
  }

  async function handleCreateChild() {
    const trimmedName = childName.trim();

    if (!trimmedName) {
      setCreatingChild(false);
      setChildName("");
      return;
    }

    await onAddChild(node.id, trimmedName);
    setCreatingChild(false);
    setChildName("");
    setExpanded(true);
  }

  async function handleDelete() {
    await onDelete(node.id);
    setConfirmingDelete(false);
  }

  return (
    <div>
      <div
        className="
          relative
          bg-gray-900/40
          border border-gray-800
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
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-300 hover:bg-gray-800"
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
                className="w-full rounded-lg border border-purple-500/40 bg-gray-950 px-2 py-1.5 text-white outline-none"
              />
            ) : (
              <div className="break-words font-medium text-white">{node.name}</div>
            )}

            <div className="mt-1.5 text-xs leading-relaxed text-gray-300">
              {node.stats.total_books} books
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
              placeholder="New child location..."
              onKeyDown={(event) => {
                if (event.key === "Enter") handleCreateChild();
                if (event.key === "Escape") {
                  setCreatingChild(false);
                  setChildName("");
                }
              }}
              className="w-full rounded-lg border border-purple-500/40 bg-gray-950 px-3 py-2 text-white outline-none"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreatingChild(false);
                  setChildName("");
                }}
                className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Create child location"
                onClick={handleCreateChild}
                disabled={!childName.trim()}
                className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        )}

        {confirmingDelete && (
          <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
            <div className="text-sm text-red-200">Delete this location?</div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 rounded-lg bg-gray-800 px-3 py-2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2"
              >
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {hasChildren && expanded && (
        <div className="mt-1 space-y-1">
          {node.children?.map((child: Location) => (
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

export function LocationTreePanel({ locations }: Props) {
  const { addLocation, editLocation, deleteLocation, reloadLocations } =
    useLocations();

  const flatLocations = useMemo(() => flattenTree(locations), [locations]);

  const [focusedId, setFocusedId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  // ================= ROOT CREATE =================

  const [creatingRoot, setCreatingRoot] = useState(false);

  const [rootName, setRootName] = useState("");

  // ================= SEARCH =================

  const searchMatches = useMemo(() => {
    if (!search.trim()) return [];

    return flatLocations.filter((l: Location) =>
      l.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [flatLocations, search]);

  // ================= FOCUS =================

  const focusedPathIds = useMemo(() => {
    if (!focusedId) return [];

    return findPathIdsToNode(locations, focusedId);
  }, [locations, focusedId]);

  const focusedPath = useMemo(() => {
    if (!focusedId) return [];

    return findPathToNode(locations, focusedId);
  }, [locations, focusedId]);

  // ================= ROOT CREATE =================

  async function handleCreateRoot() {
    if (!rootName.trim()) {
      setCreatingRoot(false);

      setRootName("");

      return;
    }

    try {
      await addLocation(rootName.trim());

      toast.success("Root location created");

      setRootName("");

      setCreatingRoot(false);
    } catch (err) {
      console.error(err);

      toast.error("Failed to create location");
    }
  }

  // ================= RENAME =================

  async function handleRename(id: number, name: string) {
    try {
      await editLocation(id, {
        name,
      });

      toast.success("Location renamed");
    } catch (err: any) {
      console.error(err);

      const message =
        err?.response?.data?.detail || "Failed to rename location";

      toast.error(message);
    }
  }

  // ================= CREATE CHILD =================

  async function handleAddChild(parentId: number, name: string) {
    try {
      await addLocation(name, parentId);

      toast.success("Location created");
    } catch (err: any) {
      console.error(err);

      const message =
        err?.response?.data?.detail || "Failed to create location";

      toast.error(message);
    }
  }

  // ================= DELETE =================

  async function handleDelete(id: number) {
    try {
      await deleteLocation(id);

      toast.success("Location deleted");

      await reloadLocations();
    } catch (err) {
      console.error(err);

      toast.error("Failed to delete location");
    }
  }

  return (
    <div className="flex flex-col">
      {/* TOOLBAR */}
      <div
        className="
          border-b border-gray-800
          px-2.5 py-3 sm:px-4 lg:px-6 lg:py-4
          bg-gray-950/40
          backdrop-blur-sm
        "
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          {/* LEFT */}
          <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:flex-1">
            {/* SEARCH */}
            <div className="w-full lg:max-w-md lg:flex-1">
              <input
                placeholder="Search locations..."
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
              <div className="flex w-full flex-col gap-2 sm:w-auto">
                <input
                  autoFocus
                  value={rootName}
                  onChange={(e) => setRootName(e.target.value)}
                  placeholder="Root location..."
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
                  rounded-xl
                  bg-gray-900
                  border border-purple-500/40
                  text-sm
                  focus:outline-none
                "
                />
                <div className="flex gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setCreatingRoot(false);
                      setRootName("");
                    }}
                    className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    aria-label="Create root location"
                    onClick={handleCreateRoot}
                    disabled={!rootName.trim()}
                    className="flex-1 rounded-lg bg-purple-600 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
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
                  text-sm font-medium
                  transition
                "
              >
                + Root Location
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
          <div className="flex items-center gap-2 self-start lg:gap-3 lg:self-auto">
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
              <span className="sm:hidden">{locations.length} roots</span>
              <span className="hidden sm:inline">{locations.length} root locations</span>
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
      <div className="lg:hidden px-1.5 py-2 sm:p-3">
        <div className="space-y-2">
          {locations.map((loc: Location) => (
            <MobileTreeNode
              key={loc.id}
              node={loc}
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
        <LocationTreeFlow
          locations={locations}
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
