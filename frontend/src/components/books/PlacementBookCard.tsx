import type { Book } from "../../types/book";

export function PlacementBookCard({ book, label }: { book: Book; label?: string }) {
  return <div className={`w-24 shrink-0 rounded-lg border p-2 text-left sm:w-32 ${label ? "border-blue-500 bg-blue-50/40 dark:border-blue-400 dark:bg-blue-950/20" : "border-border bg-surface"}`} data-placement-book={label ? "new" : book.id}>
    <div className="mb-1 text-[11px] font-semibold text-text-secondary">
      {label ? <span className="text-blue-600 dark:text-blue-400">{label}</span> : Number.isInteger(book.location_position) ? `#${book.location_position}` : null}
    </div>
    {book.cover_url ? <img src={book.cover_url} alt="" className="mb-2 h-20 w-14 rounded object-cover" /> : <div className="mb-2 h-20 w-14 rounded bg-surface-muted" aria-hidden="true" />}
    <div className="line-clamp-2 text-xs font-medium">{book.title}</div>
    <div className="line-clamp-2 text-[11px] text-text-muted">{book.author}</div>
  </div>;
}
