import React from "react";

import type { Book } from "../../../types/book";
import type { Series } from "../../../types/series";
import type { SuggestedLocation } from "../../../api/books";
import { LibraryBig } from "lucide-react";

type Props = {
  books: GridBook[];

  onSelect: (book: GridBook) => void;
  suggestedBookIds?: ReadonlySet<number>;
  suggestedLocationsByBookId?: ReadonlyMap<number, SuggestedLocation>;
  onSuggestedSelect?: (book: GridBook, location: SuggestedLocation) => void;
  showLocationPositions?: boolean;
  collections?: Series[];
  items?: GridItem[];
  onSelectCollection?: (collection: Series) => void;
};

type GridBook = Pick<Book, "id" | "title" | "author" | "cover_url" | "read" | "location_id" | "location_position" | "location_total">;
type GridItem =
  | { kind: "book"; book: GridBook }
  | { kind: "collection"; collection: Series };

function BookGridViewComponent({ books, onSelect, suggestedBookIds, suggestedLocationsByBookId, onSuggestedSelect, showLocationPositions = false, collections = [], items, onSelectCollection }: Props) {
  const [failedCollectionCovers, setFailedCollectionCovers] = React.useState<Set<number>>(() => new Set());
  const orderedItems: GridItem[] = items ?? [
    ...collections.map((collection) => ({ kind: "collection" as const, collection })),
    ...books.map((book) => ({ kind: "book" as const, book })),
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-5">
      {orderedItems.map((item) => {
        if (item.kind === "book") {
          const book = item.book;
          const isSuggested = suggestedBookIds?.has(book.id) ?? false;
          const suggestedLocation = suggestedLocationsByBookId?.get(book.id);
          const locationPosition = showLocationPositions
            && !isSuggested
            && book.location_id !== null
            && book.location_id !== undefined
            && Number.isInteger(book.location_position)
            && Number.isInteger(book.location_total)
            && (book.location_position ?? 0) > 0
            && (book.location_total ?? 0) >= (book.location_position ?? 0)
            ? book.location_position
            : null;
          const hasCover = book.cover_url && book.cover_url.trim() !== "";
          return (
            <div key={`book-${book.id}`} onClick={(e) => { e.stopPropagation(); if (isSuggested) { if (suggestedLocation) onSuggestedSelect?.(book, suggestedLocation); } else onSelect(book); }} aria-disabled={isSuggested || undefined} data-suggested-book={isSuggested || undefined} className={`${isSuggested ? `${suggestedLocation ? "cursor-pointer" : "cursor-default"} opacity-60` : "cursor-pointer"} group`}>
              <div className="relative aspect-[2/3] bg-gray-900 rounded-xl overflow-hidden shadow-md transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-1 group-hover:scale-[1.02]">
                {hasCover ? <img src={book.cover_url} onError={(e) => { e.currentTarget.style.display = "none"; }} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col justify-between p-3 bg-gradient-to-br from-gray-800 to-gray-950 text-white"><div className="text-[11px] font-semibold leading-tight line-clamp-4">{book.title}</div><div className="text-[10px] text-gray-400 line-clamp-2">{book.author}</div></div>}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                {book.read && <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-md shadow">Read</div>}
                {isSuggested && <div className="absolute bottom-2 left-2 rounded-md border border-white/20 bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white shadow">Suggested</div>}
              </div>
              <div className="mt-2 px-1"><div className="flex items-center gap-1.5"><div className="min-w-0 flex-1 truncate text-xs font-medium">{book.title}</div>{locationPosition !== null && <span data-location-position className="shrink-0 text-[10px] text-text-muted">#{locationPosition}</span>}</div><div className="truncate text-[10px] text-text-muted">{book.author}</div></div>
            </div>
          );
        }
        const collection = item.collection;
        const hasCover = Boolean(collection.cover_url?.trim()) && !failedCollectionCovers.has(collection.id);
        return <button key={`collection-${collection.id}`} type="button" onClick={() => onSelectCollection?.(collection)} aria-label={`Open collection: ${collection.name}`} className="cursor-pointer group min-w-0 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-muted shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-[1.02] group-hover:shadow-2xl">
            {hasCover ? <img src={collection.cover_url ?? undefined} alt="" className="h-full w-full object-cover" onError={() => setFailedCollectionCovers((current) => new Set(current).add(collection.id))} /> : <div className="relative flex h-full flex-col justify-end bg-gradient-to-br from-surface-raised via-surface to-surface-muted p-3 text-text-primary"><span data-testid="collection-placeholder-artwork" className="absolute inset-x-0 top-[32%] flex justify-center text-text-secondary/45"><LibraryBig size={44} strokeWidth={1.5} aria-hidden="true" /></span><span className="min-w-0"><span className="line-clamp-4 block text-[11px] font-semibold leading-tight">{collection.name}</span>{collection.author && <span className="mt-1 block line-clamp-2 text-[10px] leading-tight text-text-muted">{collection.author}</span>}</span></div>}
            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
            {hasCover && <span className="absolute right-2 top-2 inline-flex rounded-md border border-white/20 bg-black/55 p-1.5 text-white shadow" title="Collection" aria-label="Collection"><LibraryBig size={13} aria-hidden="true" /></span>}
          </div>
          <div className="mt-2 px-1"><div className="truncate text-xs font-medium text-text-primary">{collection.name}</div>{collection.author && <div className="truncate text-[10px] text-text-muted">{collection.author}</div>}</div>
        </button>;
      })}
    </div>
  );
}

// ✅ Prevent unnecessary re-renders
export const BookGridView = React.memo(BookGridViewComponent);
