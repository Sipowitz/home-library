import { StatsPanel } from "../stats/StatsPanel";

export function TopPanels({ newBook, setNewBook, onAdd, isFetching }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
      {/* ADD BOOK */}
      <div className="bg-gray-900 border border-gray-800 p-4 rounded-2xl h-full flex flex-col">
        <h2 className="text-lg mb-4">Add Book</h2>

        <input
          placeholder="Scan or enter ISBN..."
          className="p-2 bg-gray-800 w-full mb-2 rounded"
          value={newBook.isbn || ""}
          onChange={(e) => setNewBook({ ...newBook, isbn: e.target.value })}
        />

        <input
          placeholder="Title"
          className="p-2 bg-gray-800 w-full mb-2 rounded"
          value={newBook.title || ""}
          onChange={(e) => setNewBook({ ...newBook, title: e.target.value })}
        />

        <input
          placeholder="Author"
          className="p-2 bg-gray-800 w-full mb-4 rounded"
          value={newBook.author || ""}
          onChange={(e) => setNewBook({ ...newBook, author: e.target.value })}
        />

        {/* Push button to bottom */}
        <div className="mt-auto">
          <button
            onClick={onAdd}
            disabled={isFetching}
            className="bg-green-600 w-full py-2 rounded"
          >
            Add to Library
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="lg:col-span-2 h-full">
        <StatsPanel />
      </div>
    </div>
  );
}
