import { useState } from "react";
import { Loader2, Search } from "lucide-react";

type Book = {
  title?: string;
  author?: string;
  isbn?: string;
  cover_url?: string;
};

type Props = {
  newBook: Partial<Book>;
  setNewBook: (book: Partial<Book>) => void;
  onSearch: () => void;
  onAdd: () => void;
  isFetching: boolean;
};

export function AddBookForm({
  newBook,
  setNewBook,
  onSearch,
  onAdd,
  isFetching,
}: Props) {
  const [warning, setWarning] = useState<string | null>(null);

  async function handleAdd() {
    setWarning(null);

    try {
      await onAdd();
    } catch (err: any) {
      setWarning(err?.message || "Failed to add book");
    }
  }

  return (
    <div className="bg-gray-900/80 backdrop-blur border border-gray-800 p-5 rounded-2xl shadow-xl">
      {/* HEADER */}
      <h2 className="text-lg font-semibold mb-4 tracking-wide">Add Book</h2>

      {/* -------------------
          ISBN SEARCH
      ------------------- */}
      <div className="mb-4">
        <label className="text-xs text-gray-400">ISBN</label>

        <div className="flex gap-2 mt-1">
          <input
            placeholder="Scan or enter ISBN..."
            className="flex-1 p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={newBook.isbn || ""}
            onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
          />

          <button
            onClick={onSearch}
            className="px-3 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition"
          >
            {isFetching ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Search size={16} />
            )}
          </button>
        </div>
      </div>

      {/* ⚠️ WARNING */}
      {warning && (
        <div className="bg-yellow-500/90 text-black p-2 rounded-lg mb-4 text-sm">
          {warning}
        </div>
      )}

      {/* -------------------
          COVER PREVIEW
      ------------------- */}
      {newBook.cover_url && (
        <div className="flex justify-center mb-4">
          <img src={newBook.cover_url} className="w-24 rounded-lg shadow-lg" />
        </div>
      )}

      {/* -------------------
          CORE FIELDS
      ------------------- */}
      <div className="space-y-3">
        <input
          placeholder="Title"
          className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={newBook.title || ""}
          onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
        />

        <input
          placeholder="Author"
          className="w-full p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={newBook.author || ""}
          onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
        />
      </div>

      {/* -------------------
          ACTION
      ------------------- */}
      <button
        onClick={handleAdd}
        className="w-full mt-5 py-2 rounded-lg bg-green-600 hover:bg-green-700 transition font-medium"
      >
        Add to Library
      </button>
    </div>
  );
}
