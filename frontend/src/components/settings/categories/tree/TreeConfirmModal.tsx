import { ActionButton } from "../../../ui/ActionButton";

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

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ActionButton
            onClick={onConfirm}
            variant={danger ? "dangerStrong" : "primary"}
            className="w-full sm:w-auto"
          >
            {confirmText}
          </ActionButton>

          <ActionButton onClick={onCancel} variant="tertiary" className="w-full sm:w-auto">
            Cancel
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
