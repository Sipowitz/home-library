// frontend/src/components/settings/ConfirmDeleteModal.tsx

import { useEffect, useId } from "react";

import { ActionButton } from "../ui/ActionButton";

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
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="bg-surface border border-border-strong rounded-2xl w-full max-w-md p-6 text-text-primary shadow-2xl">
        <h3
          id={titleId}
          className={`text-xl font-semibold mb-3 ${
            danger ? "text-danger" : "text-text-primary"
          }`}
        >
          {title}
        </h3>

        <p className="text-sm text-text-secondary mb-4 whitespace-pre-line">
          {message}
        </p>

        {details && details.length > 0 && (
          <div className="mb-5 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface-muted p-3">
            <div className="space-y-1">
              {details.map((item, index) => (
                <div key={index} className="text-sm text-text-muted">
                  • {item}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <ActionButton
            onClick={onCancel}
            variant="tertiary"
            className="flex-1"
          >
            {cancelText}
          </ActionButton>

          <ActionButton
            onClick={onConfirm}
            variant={danger ? "dangerStrong" : "primary"}
            className="flex-1"
          >
            {confirmText}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
