import { useState, useEffect } from "react";
import { useLocations } from "../../context/LocationContext";
import { API } from "../../api/client";

import {
  fetchCategories,
  createCategory,
  deleteCategory,
} from "../../api/categories";

import type { Category } from "../../api/categories";

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

// ================= CATEGORY TREE =================
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

// ================= LOCATION TREE =================
function LocationNode({
  node,
  onDelete,
}: {
  node: any;
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
          {node.children.map((child: any) => (
            <LocationNode key={child.id} node={child} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ================= BUILD LOCATION TREE =================
function buildLocationTree(locations: any[], parentId?: number) {
  const pid = parentId ?? null;

  return locations
    .filter((l) => (l.parentId ?? l.parent_id ?? null) === pid)
    .map((loc) => ({
      ...loc,
      children: buildLocationTree(locations, loc.id),
    }));
}

export function SettingsModal({ isOpen, onClose }: Props) {
  const { locations, addLocation, deleteLocation } = useLocations();

  const [newLocation, setNewLocation] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [categoryParentId, setCategoryParentId] = useState<number | "">("");

  const [confirmDeleteLocation, setConfirmDeleteLocation] = useState<
    number | null
  >(null);

  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  const refreshCategories = async () => {
    const data = await fetchCategories();
    setCategories(data);
  };

  const locationTree = buildLocationTree(locations);

  if (!isOpen) return null;

  // ================= BACKUP =================
  async function handleBackup() {
    try {
      const res = await fetch(`${API}/backup/export`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      const blob = await res.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "library-backup.json";
      document.body.appendChild(a);
      a.click();
      a.remove();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Backup failed", err);
    }
  }

  // ================= RESTORE =================
  async function handleRestore(file: File) {
    try {
      setRestoring(true);

      const formData = new FormData();
      formData.append("file", file);

      await fetch(`${API}/backup/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });

      window.location.reload();
    } catch (err) {
      console.error("Restore failed", err);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      {/* UI unchanged */}
      <div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
        <div
          className="bg-gray-900 p-6 rounded-xl w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="text-xl mb-4">Settings</h2>

          {/* LOCATIONS */}
          <h3 className="text-lg mb-2">Locations</h3>

          <input
            placeholder="New location name"
            className="w-full p-2 bg-gray-800 rounded mb-2"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
          />

          <select
            className="w-full p-2 bg-gray-800 rounded mb-2"
            value={parentId}
            onChange={(e) =>
              setParentId(e.target.value ? Number(e.target.value) : "")
            }
          >
            <option value="">No parent</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              if (!newLocation.trim()) return;
              addLocation(newLocation, parentId || undefined);
              setNewLocation("");
              setParentId("");
            }}
            className="bg-blue-600 w-full py-2 rounded mb-4"
          >
            Add Location
          </button>

          <div className="max-h-40 overflow-y-auto text-sm space-y-1">
            {locationTree.map((loc) => (
              <LocationNode
                key={loc.id}
                node={loc}
                onDelete={(id) => setConfirmDeleteLocation(id)}
              />
            ))}
          </div>

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
            onClick={async () => {
              if (!newCategory.trim()) return;

              await createCategory(newCategory, categoryParentId || undefined);

              setNewCategory("");
              setCategoryParentId("");
              refreshCategories();
            }}
            className="bg-purple-600 w-full py-2 rounded mb-4"
          >
            Add Category
          </button>

          <div className="max-h-60 overflow-y-auto text-sm space-y-1">
            {categories.map((cat) => (
              <CategoryNode
                key={cat.id}
                node={cat}
                onDelete={async (id) => {
                  await deleteCategory(id);
                  refreshCategories();
                }}
              />
            ))}
          </div>

          {/* BACKUP / RESTORE */}
          <h3 className="text-lg mt-6 mb-2">Backup & Restore</h3>

          <button
            onClick={handleBackup}
            className="bg-green-600 w-full py-2 rounded mb-2"
          >
            Download Backup
          </button>

          <label className="block w-full">
            <span className="text-sm text-gray-400">Restore from backup</span>
            <input
              type="file"
              accept=".json"
              disabled={restoring}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRestore(file);
              }}
              className="mt-1 w-full text-sm"
            />
          </label>

          {restoring && (
            <div className="text-sm text-yellow-400 mt-2">
              Restoring backup...
            </div>
          )}

          <button
            onClick={onClose}
            className="bg-gray-600 w-full py-2 rounded mt-4"
          >
            Close
          </button>
        </div>
      </div>

      {/* DELETE MODAL UNCHANGED */}
      {confirmDeleteLocation !== null && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-xl w-80 text-center">
            <h3 className="text-lg mb-4 text-red-400 font-semibold">
              Delete Location?
            </h3>

            <p className="text-sm text-gray-400 mb-4">
              Books in this location will be unassigned.
            </p>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  if (confirmDeleteLocation === null) return;

                  try {
                    await deleteLocation(confirmDeleteLocation);
                  } catch (err) {
                    console.error("DELETE FAILED:", err);
                  }

                  setConfirmDeleteLocation(null);
                }}
                className="bg-red-600 flex-1 py-2 rounded"
              >
                Delete
              </button>

              <button
                onClick={() => setConfirmDeleteLocation(null)}
                className="bg-gray-600 flex-1 py-2 rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
