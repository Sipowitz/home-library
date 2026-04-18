import { useState, useEffect } from "react";
import { useLocations } from "../../context/LocationContext";

import {
  fetchCategories,
  createCategory,
  deleteCategory,
} from "../../api/categories";

import type { Category } from "../../api/categories";

type Props = {
  isOpen: boolean;
  apiKey: string;
  onChange: (value: string) => void;
  onSave: () => void;
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
          {node.children && node.children.length > 0 && (
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

      {open && node.children && node.children.length > 0 && (
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
function buildLocationTree(locations: any[], parentId?: number) {
  const pid = parentId ?? null;

  return locations
    .filter((l) => (l.parentId ?? null) === pid)
    .map((loc) => ({
      ...loc,
      children: buildLocationTree(locations, loc.id),
    }));
}

function flattenLocations(locations: any[], level = 0): any[] {
  let result: any[] = [];

  for (const loc of locations) {
    result.push({ ...loc, level });

    if (loc.children?.length) {
      result = result.concat(flattenLocations(loc.children, level + 1));
    }
  }

  return result;
}

export function SettingsModal({
  isOpen,
  apiKey,
  onChange,
  onSave,
  onClose,
}: Props) {
  const { locations, addLocation, deleteLocation } = useLocations();

  const [newLocation, setNewLocation] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [categoryParentId, setCategoryParentId] = useState<number | "">("");

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  const refreshCategories = async () => {
    const data = await fetchCategories();
    setCategories(data);
  };

  const tree = buildLocationTree(locations);
  const flatLocations = flattenLocations(tree);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 p-6 rounded-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl mb-4">Settings</h2>

        {/* API KEY */}
        <input
          className="w-full p-2 bg-gray-800 rounded mb-4"
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Google API key"
        />

        <button
          onClick={onSave}
          className="bg-green-600 w-full py-2 rounded mb-6"
        >
          Save API Key
        </button>

        {/* ================= LOCATIONS ================= */}
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
          {flatLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {"— ".repeat(loc.level)}
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
          {flatLocations.map((loc) => (
            <div
              key={loc.id}
              className="flex justify-between items-center bg-gray-800 px-2 py-1 rounded"
            >
              <span className="text-gray-300">
                {"— ".repeat(loc.level)}
                {loc.name}
              </span>

              <button
                onClick={() => deleteLocation(loc.id)}
                className="text-red-400 text-xs"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        {/* ================= CATEGORIES ================= */}
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

        <button
          onClick={onClose}
          className="bg-gray-600 w-full py-2 rounded mt-4"
        >
          Close
        </button>
      </div>
    </div>
  );
}
