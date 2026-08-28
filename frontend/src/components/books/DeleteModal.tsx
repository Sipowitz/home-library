import { ActionButton } from "../ui/ActionButton";

export function DeleteModal({ open, book, onClose, onDelete }: any) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-xl w-80 text-center">
        <h3 className="text-lg mb-4 text-red-400 font-semibold">
          Delete Book?
        </h3>

        <p className="text-sm text-gray-400 mb-4">
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
