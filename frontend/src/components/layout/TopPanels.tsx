import { StatsPanel } from "../stats/StatsPanel";
import { AddBookForm } from "../books/AddBookForm";

export function TopPanels({
  newBook,
  setNewBook,
  onSearch,
  onAdd,
  isFetching,
}: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
      {/* ADD BOOK */}
      <div className="h-full">
        <AddBookForm
          newBook={newBook}
          setNewBook={setNewBook}
          onSearch={onSearch}
          onAdd={onAdd}
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
