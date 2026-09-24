import type { Book } from "../../types/book";

export function OutOfLibrary({ books, onSelect }: { books: Book[]; onSelect: (book: Book) => void }) {
  if (books.length === 0) return null;
  return <section aria-label="Out of Library" className="mt-4 mb-5 px-1">
    <h2 className="mb-2 text-sm font-semibold text-text-secondary">Out of Library</h2>
    <div className="flex gap-3 overflow-x-auto pb-2">
      {books.map((book) => <button key={book.id} type="button" onClick={() => onSelect(book)} className="w-24 shrink-0 rounded-lg border border-border bg-surface p-2 text-left hover:border-blue-500 sm:w-28">
        {book.cover_url ? <img src={book.cover_url} alt="" className="mx-auto mb-1 h-24 w-16 rounded object-cover" /> : <div className="mx-auto mb-1 h-24 w-16 rounded bg-surface-muted" aria-hidden="true" />}
        <span className="block truncate text-xs font-medium">{book.title}</span>
        <span className="block truncate text-[11px] text-text-muted">{book.author}</span>
      </button>)}
    </div>
  </section>;
}
