import type { Book } from "../../types/book";
import type { SuggestedLocation } from "../../api/books";
import { ActionButton } from "../ui/ActionButton";
import { Dialog } from "../ui/Dialog";

type Props = {
  assignment: { book: Book; location: SuggestedLocation } | null;
  assigning: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function SuggestedLocationAssignmentDialog({ assignment, assigning, onClose, onConfirm }: Props) {
  const location = assignment?.location;
  const path = location?.path.map((node) => node.name).join(" → ");
  return (
    <Dialog open={assignment !== null} title={`Assign to ${location?.name ?? "Location"}?`} onClose={() => { if (!assigning) onClose(); }} className="max-w-md">
      <div className="p-5">
        <p className="text-sm text-text-secondary">Assign “{assignment?.book.title}” to <span className="font-medium text-text-primary">{location?.name}</span>?</p>
        {path && <p className="mt-3 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted">{path}</p>}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ActionButton className="w-full sm:w-auto" onClick={onClose} disabled={assigning}>Cancel</ActionButton>
          <ActionButton className="w-full sm:w-auto" variant="primary" onClick={onConfirm} disabled={assigning}>{assigning ? "Assigning…" : `Assign to ${location?.name}`}</ActionButton>
        </div>
      </div>
    </Dialog>
  );
}
