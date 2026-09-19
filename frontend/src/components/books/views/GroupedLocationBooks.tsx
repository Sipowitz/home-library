import type { GroupedBooksResponse, LocationBookGroup } from "../../../api/books";
import type { Book } from "../../../types/book";
import type { Category } from "../../../types/category";
import type { Location } from "../../../types/location";
import type { LibraryViewMode } from "../../../types/preferences";
import { BookGridView } from "./BookGridView";
import { BookListView } from "./BookListView";

type Props = {
  data: GroupedBooksResponse;
  viewMode: LibraryViewMode;
  locations: Location[];
  categories: Category[];
  showCovers: boolean;
  onSelect: (book: Book) => void;
};

function Books({ books, viewMode, locations, categories, showCovers, onSelect }: Omit<Props, "data"> & { books: Book[] }) {
  return viewMode === "grid"
    ? <BookGridView books={books} onSelect={onSelect} />
    : <BookListView books={books} locations={locations} categories={categories} showCovers={showCovers} onSelect={onSelect} />;
}

function LocationBranch({ group, depth, ...props }: Omit<Props, "data"> & { group: LocationBookGroup; depth: number }) {
  const Heading = depth === 0 ? "h2" : "h3";
  return (
    <section className={depth === 0 ? "mb-10" : "mb-8 border-l border-border pl-4"} data-location-group={group.id}>
      <Heading className={depth === 0 ? "mb-4 border-b border-border pb-2 text-sm font-semibold uppercase tracking-[0.16em] text-text-secondary" : "mb-3 text-sm font-semibold text-text-primary"}>
        {group.name}
      </Heading>
      {group.books.length > 0 && <Books books={group.books} {...props} />}
      {group.children.map((child) => <LocationBranch key={child.id} group={child} depth={depth + 1} {...props} />)}
    </section>
  );
}

export function GroupedLocationBooks({ data, ...props }: Props) {
  return (
    <div>
      {data.locations.map((group) => <LocationBranch key={group.id} group={group} depth={0} {...props} />)}
      {data.no_location && (
        <section className="mb-10" data-location-group="no-location">
          <h2 className="mb-4 border-b border-border pb-2 text-sm font-semibold uppercase tracking-[0.16em] text-text-secondary">{data.no_location.name}</h2>
          <Books books={data.no_location.books} {...props} />
        </section>
      )}
    </div>
  );
}
