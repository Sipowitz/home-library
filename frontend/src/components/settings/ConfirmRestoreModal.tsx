type Props = {
  open: boolean;
  restoring: boolean;
  file: File | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmRestoreModal({
  open,
  restoring,
  file,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 p-6 rounded-xl w-80 text-center">
        <h3 className="text-lg mb-4 text-yellow-400 font-semibold">
          Restore Backup?
        </h3>

        <p className="text-sm text-gray-400 mb-4">
          This will overwrite your current library.
        </p>

        {file && <div className="text-xs text-gray-500 mb-2">{file.name}</div>}

        <div className="flex gap-2">
          <button
            disabled={restoring}
            onClick={onConfirm}
            className={`flex-1 py-2 rounded ${
              restoring
                ? "bg-yellow-800 cursor-not-allowed"
                : "bg-yellow-600 hover:bg-yellow-700"
            }`}
          >
            {restoring ? "Restoring..." : "Restore"}
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
