import { useState } from "react";
import { createPortal } from "react-dom";

import { ActionButton } from "../ui/ActionButton";

type Props = {
  open: boolean;
  book: { id: number; title: string };
  hasCollections: boolean;
  openedInCollection: boolean;
  onClose: () => void;
  onDelete: (id: number) => Promise<void>;
};

export function DeleteModal({ open, book, hasCollections, openedInCollection, onClose, onDelete }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!open) return null;

  async function handleDelete() {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(book.id);
    } catch {
      // The application action reports deletion errors. Keep this boundary so
      // a future caller cannot turn a button click into an unhandled promise.
    } finally {
      setIsDeleting(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3" role="dialog" aria-modal="true" aria-labelledby="delete-book-title">
      <div className="w-full max-w-xs rounded-xl border border-border-strong bg-surface-raised p-6 text-center text-text-primary shadow-2xl">
        <h3 id="delete-book-title" className="mb-4 text-lg font-semibold text-danger">
          Delete Book?
        </h3>

        <p className="mb-4 text-sm text-text-secondary">
          Permanently delete <strong>“{book.title}”</strong> from your Library?
        </p>

        {openedInCollection ? (
          <p className="mb-4 text-sm text-text-secondary">
            This will delete the book from your Library, not just remove it from this Collection.
          </p>
        ) : hasCollections && (
          <p className="mb-4 text-sm text-text-secondary">
            This will also remove it from any Collections it belongs to.
          </p>
        )}

        <div className="flex gap-2">
          <ActionButton
            onClick={() => void handleDelete()}
            variant="dangerStrong"
            className="flex-1"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </ActionButton>

          <ActionButton onClick={onClose} variant="tertiary" className="flex-1" disabled={isDeleting}>
            Cancel
          </ActionButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}
