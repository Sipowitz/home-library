type Props = {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDeleteModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-xl w-80 text-center">
        <h3 className="text-lg mb-4 text-red-400 font-semibold">{title}</h3>

        <p className="text-sm text-gray-400 mb-4">{message}</p>

        <div className="flex gap-2">
          <button
            onClick={onConfirm}
            className="bg-red-600 flex-1 py-2 rounded"
          >
            Delete
          </button>

          <button
            onClick={onCancel}
            className="bg-gray-600 flex-1 py-2 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
