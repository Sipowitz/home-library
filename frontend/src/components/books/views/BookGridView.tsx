import React from "react";

import type { Book } from "../../../types/book";
import type { Series } from "../../../types/series";
import { FolderTree, GitBranch } from "lucide-react";

type Props = {
  books: Book[];

  onSelect: (book: Book) => void;
  collections?: Series[];
  items?: GridItem[];
  onSelectCollection?: (collection: Series) => void;
};

type GridBook = Pick<Book, "id" | "title" | "author" | "cover_url" | "read">;
type GridItem =
  | { kind: "book"; book: GridBook }
  | { kind: "collection"; collection: Series };

function BookGridViewComponent({ books, onSelect, collections = [], items, onSelectCollection }: Props) {
  const orderedItems: GridItem[] = items ?? [
    ...collections.map((collection) => ({ kind: "collection" as const, collection })),
    ...books.map((book) => ({ kind: "book" as const, book })),
  ];
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-5">
      {orderedItems.map((item) => {
        if (item.kind === "book") {
          const book = item.book;
          const hasCover = book.cover_url && book.cover_url.trim() !== "";
          return (
            <div key={`book-${book.id}`} onClick={(e) => { e.stopPropagation(); onSelect(book); }} className="cursor-pointer group">
              <div className="relative aspect-[2/3] bg-gray-900 rounded-xl overflow-hidden shadow-md transition-all duration-300 group-hover:shadow-2xl group-hover:-translate-y-1 group-hover:scale-[1.02]">
                {hasCover ? <img src={book.cover_url} onError={(e) => { e.currentTarget.style.display = "none"; }} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col justify-between p-3 bg-gradient-to-br from-gray-800 to-gray-950 text-white"><div className="text-[11px] font-semibold leading-tight line-clamp-4">{book.title}</div><div className="text-[10px] text-gray-400 line-clamp-2">{book.author}</div></div>}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition" />
                {book.read && <div className="absolute top-2 right-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-md shadow">Read</div>}
              </div>
              <div className="mt-2 px-1"><div className="text-xs font-medium truncate">{book.title}</div><div className="truncate text-[10px] text-text-muted">{book.author}</div></div>
            </div>
          );
        }
        const collection = item.collection;
        const isGroup = collection.node_type === "group";
        return <button key={`collection-${collection.id}`} type="button" onClick={() => onSelectCollection?.(collection)} className="cursor-pointer group min-w-0 text-left">
          <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface-muted shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-[1.02] group-hover:shadow-2xl">
            {collection.cover_url ? <img src={collection.cover_url} alt="" className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="flex h-full flex-col justify-between bg-gradient-to-br from-surface-raised to-surface-muted p-3 text-text-primary"><span className="line-clamp-4 text-[11px] font-semibold leading-tight">{collection.name}</span><span className="text-[10px] text-text-muted">{isGroup ? "Group" : "Series"}</span></div>}
            <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
            <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md border border-white/20 bg-black/55 px-1.5 py-1 text-[10px] text-white shadow" title={isGroup ? "Group" : "Series"}>{isGroup ? <FolderTree size={12} /> : <GitBranch size={12} />}{isGroup ? "Group" : "Series"}</span>
          </div>
          <div className="mt-2 px-1"><div className="truncate text-xs font-medium text-text-primary">{collection.name}</div><div className="truncate text-[10px] text-text-muted">{isGroup ? "Group" : "Series"}</div></div>
        </button>;
      })}
    </div>
  );
}

// ✅ Prevent unnecessary re-renders
export const BookGridView = React.memo(BookGridViewComponent);
