// frontend/src/components/settings/locations/LocationTreePanel.tsx

import { useMemo, useState } from "react";

import toast from "react-hot-toast";

import type { Location } from "../../../types/location";

import { useLocations } from "../../../context/LocationContext";

import { LocationTreeFlow } from "./tree/LocationTreeFlow";

import {
  flattenCategories as flattenLocations,
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
}: {
  node: Location;

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
            {node.children?.length || 0} children
          </div>
        </div>
      </div>

      {(node.children?.length ?? 0) > 0 && (
        <div className="mt-1 space-y-1">
          {node.children?.map((child: Location) => (
            <MobileTreeNode key={child.id} node={child} level={level + 1} />
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

  const flatLocations = useMemo(() => flattenLocations(locations), [locations]);

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
              {locations.length} root locations
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
          {locations.map((loc: Location) => (
            <MobileTreeNode key={loc.id} node={loc} level={0} />
          ))}
        </div>
      </div>

      {/* DESKTOP */}
      <div className="hidden lg:flex flex-1">
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
