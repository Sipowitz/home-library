import { X } from "lucide-react";
import { useLocations } from "../../context/LocationContext";

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
  category?: string;
  date_added?: string;
};

type Props = {
  book: Book | null;
  editing: boolean;
  editData: Book | null;
  setEditing: (value: boolean) => void;
  setEditData: (book: Book) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: (id: number) => void;
};

// 🔧 Build hierarchical list
function buildLocationTree(locations: any[], parentId?: number, level = 0) {
  const pid = parentId ?? null;

  return locations
    .filter((l) => l.parent_id === pid)
    .flatMap((loc) => [
      { ...loc, level },
      ...buildLocationTree(locations, loc.id, level + 1),
    ]);
}

// 📅 Format date DD/MM/YYYY
function formatDate(dateString?: string) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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

  if (!book) return null;

  // 🔑 Map ID → name
  const locationName = locations.find((l) => l.id === book.location_id)?.name;

  return (
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* PANEL */}
      <div
        className="fixed top-4 right-4 bottom-4 w-[36rem] max-w-[90vw] bg-gray-900/95 backdrop-blur p-4 shadow-2xl rounded-xl border border-gray-800 z-50 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="mb-2">
          <X />
        </button>

        {!editing ? (
          <>
            {/* VIEW MODE */}
            <div className="flex gap-4 mb-4">
              <img
                src={
                  book.cover_url ||
                  "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
                }
                className="w-32 h-auto rounded shadow"
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

            {/* METADATA */}
            <div className="mb-4 text-sm space-y-1 border-t border-gray-800 pt-3">
              <div>
                <strong>Location:</strong> {locationName || "—"}
              </div>

              {book.category && (
                <div>
                  <strong>Category:</strong> {book.category}
                </div>
              )}

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

            {/* DESCRIPTION */}
            {book.description && (
              <div className="mb-4 border-t border-gray-800 pt-3">
                <h3 className="text-sm font-semibold mb-1">Description</h3>
                <p className="text-sm text-gray-300 max-h-40 overflow-y-auto">
                  {book.description}
                </p>
              </div>
            )}

            {/* ACTIONS */}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => {
                  setEditing(true);
                  setEditData(book);
                }}
                className="bg-yellow-600 w-full py-2 rounded hover:bg-yellow-500"
              >
                Edit
              </button>

              <button
                onClick={() => onDelete(book.id)}
                className="bg-red-600 w-full py-2 rounded hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </>
        ) : (
          <>
            {/* EDIT MODE */}
            <div className="flex gap-4 mb-4">
              <img
                src={editData?.cover_url || ""}
                className="w-32 h-auto rounded shadow"
              />

              <div className="flex-1 space-y-2">
                <input
                  className="w-full p-2 bg-gray-700 rounded text-lg font-bold"
                  value={editData?.title || ""}
                  onChange={(e) =>
                    setEditData({ ...editData!, title: e.target.value })
                  }
                />

                <input
                  className="w-full p-2 bg-gray-700 rounded text-gray-300"
                  value={editData?.author || ""}
                  onChange={(e) =>
                    setEditData({ ...editData!, author: e.target.value })
                  }
                />

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editData?.read || false}
                    onChange={(e) =>
                      setEditData({ ...editData!, read: e.target.checked })
                    }
                  />
                  Read
                </label>
              </div>
            </div>

            {/* METADATA */}
            <div className="mb-4 space-y-2 border-t border-gray-800 pt-3 text-sm">
              {/* LOCATION SELECT */}
              <select
                className="w-full p-2 bg-gray-700 rounded"
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

              <input
                placeholder="Category"
                className="w-full p-2 bg-gray-700 rounded"
                value={editData?.category || ""}
                onChange={(e) =>
                  setEditData({ ...editData!, category: e.target.value })
                }
              />

              <input
                placeholder="ISBN"
                className="w-full p-2 bg-gray-700 rounded"
                value={editData?.isbn || ""}
                onChange={(e) =>
                  setEditData({ ...editData!, isbn: e.target.value })
                }
              />

              <input
                placeholder="Year"
                className="w-full p-2 bg-gray-700 rounded"
                value={editData?.year || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData!,
                    year: Number(e.target.value),
                  })
                }
              />

              {editData?.date_added && (
                <div className="text-xs text-gray-400">
                  Added: {formatDate(editData.date_added)}
                </div>
              )}

              <textarea
                placeholder="Description"
                className="w-full p-2 bg-gray-700 rounded min-h-[100px]"
                value={editData?.description || ""}
                onChange={(e) =>
                  setEditData({
                    ...editData!,
                    description: e.target.value,
                  })
                }
              />
            </div>

            {/* ACTIONS */}
            <div className="space-y-2">
              <button
                onClick={onSave}
                className="bg-green-600 w-full py-2 rounded hover:bg-green-500"
              >
                Save
              </button>

              <button
                onClick={() => setEditing(false)}
                className="bg-gray-600 w-full py-2 rounded hover:bg-gray-500"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
