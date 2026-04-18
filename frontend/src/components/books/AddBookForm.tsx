import { useEffect, useState } from "react";
import { useLocations } from "../../context/LocationContext";
import { fetchCategories } from "../../api/categories";
import type { Category } from "../../api/categories";

type Book = {
  title?: string;
  author?: string;
  year?: number;
  isbn?: string;
  description?: string;
  cover_url?: string;
  location_id?: number;
  category_ids?: number[];
  read?: boolean;
};

type Props = {
  newBook: Partial<Book>;
  setNewBook: (book: Partial<Book>) => void;
  onSearch: () => void;
  onAdd: (category_ids: number[]) => void; // 🔥 IMPORTANT CHANGE
  isFetching: boolean;
};

// 🔧 Build location tree (same as BookPanel)
function buildLocationTree(locations: any[], parentId?: number, level = 0) {
  const pid = parentId ?? null;

  return locations
    .filter((l) => l.parent_id === pid)
    .flatMap((loc) => [
      { ...loc, level },
      ...buildLocationTree(locations, loc.id, level + 1),
    ]);
}

export function AddBookForm({
  newBook,
  setNewBook,
  onSearch,
  onAdd,
  isFetching,
}: Props) {
  const { locations } = useLocations();
  const tree = buildLocationTree(locations);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  // 🔧 Flatten categories (for hierarchy display)
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

  return (
    <div className="bg-gray-800 p-4 rounded-xl shadow">
      {/* ISBN SEARCH */}
      <div className="flex gap-2 mb-3">
        <input
          placeholder="ISBN"
          className="p-2 bg-gray-700 flex-1 rounded"
          value={newBook.isbn || ""}
          onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
        />
        <button
          onClick={onSearch}
          className="bg-blue-600 px-3 rounded hover:bg-blue-500"
        >
          {isFetching ? "..." : "Search"}
        </button>
      </div>

      {/* COVER */}
      {newBook.cover_url && (
        <div className="flex justify-center mb-3">
          <img src={newBook.cover_url} className="w-24 rounded shadow" />
        </div>
      )}

      {/* TITLE */}
      <input
        placeholder="Title"
        className="p-2 bg-gray-700 w-full mb-2 rounded"
        value={newBook.title || ""}
        onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
      />

      {/* AUTHOR */}
      <input
        placeholder="Author"
        className="p-2 bg-gray-700 w-full mb-2 rounded"
        value={newBook.author || ""}
        onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
      />

      {/* YEAR */}
      <input
        placeholder="Year"
        type="number"
        className="p-2 bg-gray-700 w-full mb-2 rounded"
        value={newBook.year ?? ""}
        onChange={(e) =>
          setNewBook({
            ...newBook,
            year: e.target.value ? Number(e.target.value) : undefined,
          })
        }
      />

      {/* LOCATION SELECT ✅ */}
      <select
        className="w-full p-2 bg-gray-700 rounded mb-2"
        value={newBook.location_id || ""}
        onChange={(e) =>
          setNewBook({
            ...newBook,
            location_id: e.target.value ? Number(e.target.value) : undefined,
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

      {/* 🏷️ CATEGORY SELECT ✅ */}
      <div className="mb-3">
        <div className="text-gray-400 mb-1 text-sm">Categories</div>
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

      {/* DESCRIPTION */}
      <textarea
        placeholder="Description"
        className="p-2 bg-gray-700 w-full mb-2 rounded min-h-[80px]"
        value={newBook.description || ""}
        onChange={(e) =>
          setNewBook({ ...newBook, description: e.target.value })
        }
      />

      {/* READ */}
      <label className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          checked={newBook.read || false}
          onChange={(e) => setNewBook({ ...newBook, read: e.target.checked })}
        />
        Read
      </label>

      {/* ADD BUTTON 🔥 */}
      <button
        onClick={() => {
          onAdd(selectedCategories);
          setSelectedCategories([]); // ✅ reset after add
        }}
        className="bg-green-600 w-full py-2 rounded hover:bg-green-500"
      >
        Add
      </button>
    </div>
  );
}
