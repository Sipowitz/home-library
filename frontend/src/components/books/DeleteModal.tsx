import { ActionButton } from "../ui/ActionButton";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Existing modal prop contract is outside this appearance-only change.
export function DeleteModal({ open, book, onClose, onDelete }: any) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-80 rounded-xl border border-border-strong bg-surface-raised p-6 text-center text-text-primary shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-danger">
          Delete Book?
        </h3>

        <p className="mb-4 text-sm text-text-secondary">
          Delete <strong>{book.title}</strong>?
        </p>

        <div className="flex gap-2">
          <ActionButton
            onClick={() => onDelete(book.id)}
            variant="dangerStrong"
            className="flex-1"
          >
            Delete
          </ActionButton>

          <ActionButton onClick={onClose} variant="tertiary" className="flex-1">
            Cancel
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
