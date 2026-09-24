import type { SuggestedBook, SuggestedLocation } from "../../api/books";
import { ActionButton } from "../ui/ActionButton";
import { Dialog } from "../ui/Dialog";
import { PlacementBookCard } from "./PlacementBookCard";

type Props = {
  assignment: { book: SuggestedBook; location: SuggestedLocation | null } | null;
  assigning: boolean;
  onClose: () => void;
  onSelectLocation: (location: SuggestedLocation) => void;
  onBack: () => void;
  onConfirm: () => void;
  onViewBook: () => void;
};

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
              {(suggestion.before ?? []).map((existing) => <PlacementBookCard key={existing.id} book={existing} />)}
              <PlacementBookCard book={book} label="NEW BOOK" />
              {(suggestion.after ?? []).map((existing) => <PlacementBookCard key={existing.id} book={existing} />)}
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
