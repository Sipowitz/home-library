import { useState } from "react";

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
  // ✅ NEW — local warning state (for duplicate ISBN etc.)
  const [warning, setWarning] = useState<string | null>(null);

  async function handleAdd() {
    setWarning(null);

    try {
      await onAdd();

      // NOTE:
      // Warning handling will be passed up later if needed
      // (keeping this minimal + non-breaking)
    } catch (err: any) {
      setWarning(err?.message || "Failed to add book");
    }
  }

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

      {/* ⚠️ WARNING */}
      {warning && (
        <div className="bg-yellow-600 text-black p-2 rounded mb-3 text-sm">
          {warning}
        </div>
      )}

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
        className="p-2 bg-gray-700 w-full mb-4 rounded"
        value={newBook.author || ""}
        onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
      />

      {/* ADD BUTTON */}
      <button
        onClick={handleAdd} // ✅ UPDATED
        className="bg-green-600 w-full py-2 rounded hover:bg-green-500"
      >
        Add
      </button>
    </div>
  );
}
