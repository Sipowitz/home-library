import { StatsPanel } from "../stats/StatsPanel";
import { AddBookForm } from "../books/AddBookForm";

export function TopPanels({
  newBook,
  setNewBook,
  onSearch,
  onAdd,
  onReset,
  onISBNChange,
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
          onReset={onReset}
          onISBNChange={onISBNChange}
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
