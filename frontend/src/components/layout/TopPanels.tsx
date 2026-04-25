import { AddBookForm } from "../books/AddBookForm";
import { StatsPanel } from "../stats/StatsPanel";

type Category = {
  id: number;
  name: string;
};

type Book = {
  id?: number;
  title?: string;
  author?: string;
  year?: number;
  isbn?: string;
  description?: string;
  read?: boolean;
  location_id?: number;
  cover_url?: string;
  categories?: Category[];
  category_ids?: number[];
  date_added?: string;
};

type Props = {
  newBook: Partial<Book>;
  setNewBook: (book: Partial<Book>) => void;
  onSearch: () => void;
  onAdd: () => void;
  isFetching: boolean;
};

export function TopPanels({
  newBook,
  setNewBook,
  onSearch,
  onAdd,
  isFetching,
}: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-stretch">
      <div className="lg:col-span-1 h-full">
        <AddBookForm
          newBook={newBook}
          setNewBook={setNewBook}
          onSearch={onSearch}
          onAdd={onAdd}
          isFetching={isFetching}
        />
      </div>

      <div className="lg:col-span-2 h-full">
        <StatsPanel />
      </div>
    </div>
  );
}
