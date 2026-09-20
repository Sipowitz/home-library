import type { GroupedBooksResponse, LocationBookGroup, SuggestedBook, SuggestedLocation } from "../../../api/books";
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
  onSuggestedSelect?: (book: Book, location: SuggestedLocation) => void;
};

type DerivedBook = { book: Book; suggested: boolean; suggestedLocation?: SuggestedLocation };
type SuggestedPlacement = { book: SuggestedBook; location: SuggestedLocation };

function authorOrder(book: Book) {
  return book.author.trim().split(/\s+/).at(-1)?.toLocaleLowerCase() ?? "";
}

function mergeBooks(assignedBooks: Book[], suggestedBooks: SuggestedPlacement[]): DerivedBook[] {
  return [
    ...assignedBooks.map((book) => ({ book, suggested: false })),
    ...suggestedBooks.map(({ book, location }) => ({ book, suggested: true, suggestedLocation: location })),
  ].sort((left, right) => authorOrder(left.book).localeCompare(authorOrder(right.book)) || left.book.id - right.book.id);
}

function Books({ books, viewMode, locations, categories, showCovers, onSelect, onSuggestedSelect }: Omit<Props, "data"> & { books: DerivedBook[] }) {
  const suggestedBookIds = new Set(books.filter(({ suggested }) => suggested).map(({ book }) => book.id));
  const suggestedLocationsByBookId = new Map(books.flatMap(({ book, suggestedLocation }) => suggestedLocation ? [[book.id, suggestedLocation] as const] : []));
  const renderedBooks = books.map(({ book }) => book);
  return viewMode === "grid"
    ? <BookGridView books={renderedBooks} suggestedBookIds={suggestedBookIds} suggestedLocationsByBookId={suggestedLocationsByBookId} onSuggestedSelect={onSuggestedSelect} showLocationPositions onSelect={onSelect} />
    : <BookListView books={renderedBooks} suggestedBookIds={suggestedBookIds} suggestedLocationsByBookId={suggestedLocationsByBookId} onSuggestedSelect={onSuggestedSelect} showLocationPositions locations={locations} categories={categories} showCovers={showCovers} onSelect={onSelect} />;
}

function LocationBranch({ group, depth, suggestionsByLocation, ...props }: Omit<Props, "data"> & { group: LocationBookGroup; depth: number; suggestionsByLocation: Map<number, SuggestedPlacement[]> }) {
  const Heading = depth === 0 ? "h2" : "h3";
  return (
    <section className={depth === 0 ? "mb-10" : "mb-8 border-l border-border pl-4"} data-location-group={group.id}>
      <Heading className={depth === 0 ? "mb-4 border-b border-border pb-2 text-sm font-semibold uppercase tracking-[0.16em] text-text-secondary" : "mb-3 text-sm font-semibold text-text-primary"}>
        {group.name}
      </Heading>
      {(group.books.length > 0 || suggestionsByLocation.has(group.id)) && <Books books={mergeBooks(group.books, suggestionsByLocation.get(group.id) ?? [])} {...props} />}
      {group.children.map((child) => <LocationBranch key={child.id} group={child} depth={depth + 1} suggestionsByLocation={suggestionsByLocation} {...props} />)}
    </section>
  );
}

export function GroupedLocationBooks({ data, ...props }: Props) {
  const suggestionsByLocation = new Map<number, SuggestedPlacement[]>();
  for (const book of data.no_location?.books ?? []) {
    for (const location of book.suggested_locations ?? []) {
      const suggestions = suggestionsByLocation.get(location.id) ?? [];
      suggestions.push({ book, location });
      suggestionsByLocation.set(location.id, suggestions);
    }
  }

  return (
    <div>
      {data.locations.map((group) => <LocationBranch key={group.id} group={group} depth={0} suggestionsByLocation={suggestionsByLocation} {...props} />)}
      {data.no_location && (
        <section className="mb-10" data-location-group="no-location">
          <h2 className="mb-4 border-b border-border pb-2 text-sm font-semibold uppercase tracking-[0.16em] text-text-secondary">{data.no_location.name}</h2>
          <Books books={data.no_location.books.map((book) => ({ book, suggested: false }))} {...props} />
        </section>
      )}
    </div>
  );
}
