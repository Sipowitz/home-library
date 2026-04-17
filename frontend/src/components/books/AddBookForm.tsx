import React from "react";

type Book = {
  title?: string;
  author?: string;
  year?: number;
  isbn?: string;
  description?: string;
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

      {/* COVER PREVIEW */}
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

      {/* DESCRIPTION */}
      <textarea
        placeholder="Description"
        className="p-2 bg-gray-700 w-full mb-3 rounded min-h-[80px]"
        value={newBook.description || ""}
        onChange={(e) =>
          setNewBook({ ...newBook, description: e.target.value })
        }
      />

      {/* ADD BUTTON */}
      <button
        onClick={onAdd}
        className="bg-green-600 w-full py-2 rounded hover:bg-green-500"
      >
        Add
      </button>
    </div>
  );
}
