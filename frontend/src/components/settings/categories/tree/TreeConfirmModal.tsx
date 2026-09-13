type Props = {
  open: boolean;

  title: string;

  message: string;

  confirmText?: string;

  danger?: boolean;

  onConfirm: () => void;

  onCancel: () => void;
};

export function TreeConfirmModal({
  open,

  title,

  message,

  confirmText = "Confirm",

  danger = false,

  onConfirm,

  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="
        fixed inset-0 z-[100]

        bg-black/50
        backdrop-blur-sm

        flex items-center justify-center

        p-4
      "
      onClick={onCancel}
    >
      <div
        className="
          w-full max-w-md

          rounded-2xl

          border border-border-strong

          bg-surface text-text-primary

          shadow-2xl

          p-6
        "
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl font-semibold text-text-primary">{title}</h2>

        <p className="text-sm text-text-muted mt-3 leading-relaxed">{message}</p>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onCancel}
            className="
              px-4 py-2

              rounded-xl

              bg-control text-text-secondary
              hover:bg-surface-raised hover:text-text-primary

              transition
            "
          >
            Cancel
          </button>

          <button
            onClick={onConfirm}
            className={`
              px-4 py-2
              rounded-xl
              transition

              ${
                danger
                  ? `
                    bg-red-600
                    hover:bg-red-500
                  `
                  : `
                    bg-purple-600
                    hover:bg-purple-500
                  `
              }
            `}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
