import type { SuggestedBook, SuggestedLocation } from "../../api/books";
import type { Book } from "../../types/book";
import { ActionButton } from "../ui/ActionButton";
import { Dialog } from "../ui/Dialog";

type Props = {
  assignment: { book: SuggestedBook; location: SuggestedLocation | null } | null;
  assigning: boolean;
  onClose: () => void;
  onSelectLocation: (location: SuggestedLocation) => void;
  onBack: () => void;
  onConfirm: () => void;
  onViewBook: () => void;
};

function PlacementBook({ book, isNew = false }: { book: Book; isNew?: boolean }) {
  return <div className={`w-24 shrink-0 rounded-lg border p-2 text-left sm:w-32 ${isNew ? "border-blue-500 bg-blue-50/40 dark:border-blue-400 dark:bg-blue-950/20" : "border-border bg-surface"}`} data-placement-book={isNew ? "new" : book.id}>
    <div className="mb-1 text-[11px] font-semibold text-text-secondary">
      {isNew ? <span className="text-blue-600 dark:text-blue-400">NEW BOOK</span> : Number.isInteger(book.location_position) ? `#${book.location_position}` : null}
    </div>
    {book.cover_url ? <img src={book.cover_url} alt="" className="mb-2 h-20 w-14 rounded object-cover" /> : <div className="mb-2 h-20 w-14 rounded bg-surface-muted" aria-hidden="true" />}
    <div className="line-clamp-2 text-xs font-medium">{book.title}</div>
    <div className="line-clamp-2 text-[11px] text-text-muted">{book.author}</div>
  </div>;
}

export function SuggestedLocationAssignmentDialog({ assignment, assigning, onClose, onSelectLocation, onBack, onConfirm, onViewBook }: Props) {
  const book = assignment?.book;
  const location = assignment?.location;
  return (
    <Dialog open={assignment !== null} title={location ? `Assign to ${location.name}?` : `Suggested placements for ${book?.title ?? "book"}`} onClose={() => { if (!assigning) onClose(); }} className="max-w-4xl">
      <div className="space-y-4 p-5">
        {location ? <>
          <p className="text-sm text-text-secondary">Assign “{book?.title}” to <span className="font-medium text-text-primary">{location.name}</span>?</p>
          <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">{location.path.map((node) => node.name).join(" → ") || location.name}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <ActionButton onClick={onBack} disabled={assigning}>Back to placements</ActionButton>
            <ActionButton variant="primary" onClick={onConfirm} disabled={assigning}>{assigning ? "Assigning…" : `Confirm assignment to ${location.name}`}</ActionButton>
          </div>
        </> : <>
          <p className="text-sm text-text-secondary">Choose a physical placement for “{book?.title}”. No Location change is made until you confirm.</p>
          {book?.suggested_locations?.length ? book.suggested_locations.map((suggestion, index) => <button key={`${suggestion.id}-${index}`} type="button" onClick={() => onSelectLocation(suggestion)} className="block w-full rounded-xl border border-border bg-surface p-3 text-left hover:border-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" data-placement-option={suggestion.id}>
            <span className="block text-sm font-semibold">{suggestion.path.map((node) => node.name).join(" → ") || suggestion.name}</span>
            <span className="mt-1 block text-xs text-text-muted">Select this placement</span>
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {(suggestion.before ?? []).map((existing) => <PlacementBook key={existing.id} book={existing} />)}
              <PlacementBook book={book} isNew />
              {(suggestion.after ?? []).map((existing) => <PlacementBook key={existing.id} book={existing} />)}
            </div>
          </button>) : <p className="text-sm text-text-muted">No physical placement suggestions are available for this book.</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton onClick={onViewBook}>View book</ActionButton>
            <ActionButton onClick={onClose}>Close</ActionButton>
          </div>
        </>}
      </div>
    </Dialog>
  );
}
