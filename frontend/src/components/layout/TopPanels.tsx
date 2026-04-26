import { StatsPanel } from "../stats/StatsPanel";
import { AddBookForm } from "../books/AddBookForm";

export function TopPanels({
  newBook,
  setNewBook,
  onAdd,
  onSearch,
  isFetching,
}: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
      {/* ADD BOOK */}
      <div className="h-full">
        <AddBookForm
          newBook={newBook}
          setNewBook={setNewBook}
          onAdd={onAdd}
          onSearch={onSearch}
          isFetching={isFetching}
        />
      </div>

      {/* STATS */}
      <div className="lg:col-span-2 h-full">
        <StatsPanel />
      </div>
    </div>
  );
}
