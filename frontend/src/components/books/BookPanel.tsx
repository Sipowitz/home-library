import { X } from "lucide-react";
import { useLocations } from "../../context/LocationContext";
import { useEffect, useState, useRef } from "react";
import { fetchCategories } from "../../api/categories";
import type { Category } from "../../api/categories";

type Book = {
  id: number;
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  description?: string;
  read?: boolean;
  location_id?: number;
  cover_url?: string;
  categories?: { id: number; name: string }[];
  category_ids?: number[];
  date_added?: string;
};

type Props = {
  book: Book | null;
  editing: boolean;
  editData: Book | null;
  setEditing: (value: boolean) => void;
  setEditData: (book: Book) => void;
  onClose: () => void;
  onSave: (category_ids: number[]) => void;
  onDelete: (id: number) => void;
};

// 📍 Location tree
function buildLocationTree(locations: any[], parentId?: number, level = 0) {
  const pid = parentId ?? null;

  return locations
    .filter((l) => l.parent_id === pid)
    .flatMap((loc) => [
      { ...loc, level },
      ...buildLocationTree(locations, loc.id, level + 1),
    ]);
}

function formatDate(dateString?: string) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1,
  ).padStart(2, "0")}/${d.getFullYear()}`;
}

export function BookPanel({
  book,
  editing,
  editData,
  setEditing,
  setEditData,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { locations } = useLocations();
  const tree = buildLocationTree(locations);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  // Sync selected categories
  useEffect(() => {
    if (!editData) return;

    if (editData.category_ids?.length) {
      setSelectedCategories(editData.category_ids);
    } else if (editData.categories?.length) {
      setSelectedCategories(editData.categories.map((c) => c.id));
    } else {
      setSelectedCategories([]);
    }
  }, [editData]);

  // Auto resize textarea
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (textareaRef.current) {
        const el = textareaRef.current;
        el.style.height = "auto";
        el.style.height = el.scrollHeight + "px";
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [editing, editData]);

  // Flatten categories
  const flatten = (cats: Category[], prefix = ""): Category[] => {
    let result: Category[] = [];

    for (const cat of cats) {
      const name = prefix ? `${prefix} > ${cat.name}` : cat.name;
      result.push({ ...cat, name });

      if (cat.children?.length) {
        result = result.concat(flatten(cat.children, name));
      }
    }

    return result;
  };

  const flatCategories = flatten(categories);

  const toggleCategory = (id: number) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  if (!book) return null;

  function getLocationPath(locations: any[], id?: number): string {
    if (!id) return "";

    const map = new Map(locations.map((l) => [l.id, l]));
    let current = map.get(id);

    const path: string[] = [];

    while (current) {
      path.unshift(current.name);
      current = map.get(current.parentId ?? current.parent_id);
    }

    return path.join(" > ");
  }

  const locationName = getLocationPath(locations, book.location_id);

  // ✅ CATEGORY DISPLAY FIX
  const categoryNames = book.categories?.length
    ? book.categories.map((c) => c.name)
    : book.category_ids
        ?.map((id) => flatCategories.find((c) => c.id === id)?.name)
        .filter(Boolean);

  return (
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* PANEL */}
      <div
        className="fixed top-4 right-4 
        w-[95vw] sm:w-[600px] 
        h-auto max-h-[95vh]
        bg-gray-900/95 backdrop-blur p-5 shadow-2xl rounded-2xl border border-gray-800
        z-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="mb-2">
          <X />
        </button>

        <div className="flex-1 overflow-y-auto pr-1">
          {!editing ? (
            <>
              {/* VIEW MODE */}
              <div className="flex gap-4 mb-4">
                <img
                  src={
                    book.cover_url ||
                    "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
                  }
                  className="w-32 rounded shadow"
                />

                <div className="flex-1">
                  <h2 className="text-xl font-bold">{book.title}</h2>
                  <p className="text-gray-400 mb-2">{book.author}</p>

                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      book.read ? "bg-green-600" : "bg-gray-700"
                    }`}
                  >
                    {book.read ? "Read" : "Unread"}
                  </span>
                </div>
              </div>

              <div className="mb-4 text-sm space-y-2 border-t border-gray-800 pt-3">
                <div>
                  <strong>Location:</strong> {locationName || "—"}
                </div>

                {categoryNames?.length ? (
                  <div>
                    <strong>Categories:</strong> {categoryNames.join(", ")}
                  </div>
                ) : null}

                {book.isbn && (
                  <div>
                    <strong>ISBN:</strong> {book.isbn}
                  </div>
                )}
                {book.year && (
                  <div>
                    <strong>Year:</strong> {book.year}
                  </div>
                )}
                {book.date_added && (
                  <div>
                    <strong>Added:</strong> {formatDate(book.date_added)}
                  </div>
                )}
              </div>

              {book.description && (
                <div className="mb-4 border-t border-gray-800 pt-3">
                  <h3 className="text-sm font-semibold mb-1">Description</h3>
                  <p className="text-sm text-gray-300 whitespace-pre-line">
                    {book.description}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* EDIT MODE */}
              <div className="flex gap-4 mb-4">
                <img src={editData?.cover_url || ""} className="w-32 rounded" />

                <div className="flex-1 space-y-2">
                  <input
                    className="w-full p-2 bg-gray-700 rounded"
                    value={editData?.title || ""}
                    onChange={(e) =>
                      setEditData({ ...editData!, title: e.target.value })
                    }
                  />

                  <input
                    className="w-full p-2 bg-gray-700 rounded"
                    value={editData?.author || ""}
                    onChange={(e) =>
                      setEditData({ ...editData!, author: e.target.value })
                    }
                  />

                  <label className="flex gap-2">
                    <input
                      type="checkbox"
                      checked={editData?.read || false}
                      onChange={(e) =>
                        setEditData({
                          ...editData!,
                          read: e.target.checked,
                        })
                      }
                    />
                    Read
                  </label>
                </div>
              </div>

              {/* LOCATION */}
              <select
                className="w-full p-2 bg-gray-700 rounded mb-2"
                value={editData?.location_id || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData!,
                    location_id: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  })
                }
              >
                <option value="">Select location</option>
                {tree.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {"— ".repeat(loc.level) + loc.name}
                  </option>
                ))}
              </select>

              {/* CATEGORIES */}
              <div className="mb-3">
                <div className="text-gray-400 mb-1">Categories</div>
                <div className="max-h-32 overflow-y-auto bg-gray-700 p-2 rounded">
                  {flatCategories.map((cat) => (
                    <label key={cat.id} className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              </div>

              <input
                className="w-full p-2 bg-gray-700 rounded mb-2"
                value={editData?.isbn || ""}
                onChange={(e) =>
                  setEditData({ ...editData!, isbn: e.target.value })
                }
              />

              <input
                className="w-full p-2 bg-gray-700 rounded mb-2"
                value={editData?.year || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData!,
                    year: Number(e.target.value),
                  })
                }
              />

              <textarea
                key={editData?.id}
                ref={textareaRef}
                rows={3}
                className="w-full p-2 bg-gray-700 rounded resize-none overflow-hidden"
                value={editData?.description || ""}
                onChange={(e) => {
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = el.scrollHeight + "px";

                  setEditData({
                    ...editData!,
                    description: e.target.value,
                  });
                }}
              />
            </>
          )}
        </div>

        {/* ACTIONS */}
        <div className="mt-4 space-y-2">
          {!editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(true);
                  setEditData(book);
                }}
                className="bg-yellow-600 w-full py-2 rounded"
              >
                Edit
              </button>

              <button
                onClick={() => setConfirmDelete(true)}
                className="bg-red-600 w-full py-2 rounded"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onSave(selectedCategories)}
                className="bg-green-600 w-full py-2 rounded"
              >
                Save
              </button>

              <button
                onClick={() => setEditing(false)}
                className="bg-gray-600 w-full py-2 rounded"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* DELETE MODAL */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded-xl w-80 text-center">
            <h3 className="text-lg mb-4 text-red-400 font-semibold">
              Delete Book?
            </h3>

            <p className="text-sm text-gray-400 mb-4">
              Delete <strong>{book.title}</strong>?
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onDelete(book.id);
                  setConfirmDelete(false);
                }}
                className="bg-red-600 flex-1 py-2 rounded"
              >
                Delete
              </button>

              <button
                onClick={() => setConfirmDelete(false)}
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
