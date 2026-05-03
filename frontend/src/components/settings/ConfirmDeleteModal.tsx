// frontend/src/components/settings/ConfirmDeleteModal.tsx

type Props = {
  open: boolean;
  title: string;
  message: string;
  details?: string[];
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDeleteModal({
  open,
  title,
  message,
  details,
  confirmText = "Delete",
  cancelText = "Cancel",
  danger = true,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3
          className={`text-xl font-semibold mb-3 ${
            danger ? "text-red-400" : "text-white"
          }`}
        >
          {title}
        </h3>

        <p className="text-sm text-gray-300 mb-4 whitespace-pre-line">
          {message}
        </p>

        {details && details.length > 0 && (
          <div className="mb-5 max-h-48 overflow-y-auto rounded-lg border border-gray-800 bg-gray-950/60 p-3">
            <div className="space-y-1">
              {details.map((item, index) => (
                <div key={index} className="text-sm text-gray-400">
                  • {item}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition"
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-lg transition ${
              danger
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
