import { useEffect, useState } from "react";

import { ActionButton } from "../../../ui/ActionButton";

type Props = {
  open: boolean;

  title: string;

  placeholder?: string;

  confirmText?: string;

  initialValue?: string;

  onConfirm: (value: string) => void;

  onCancel: () => void;
};

export function TreeInputModal({
  open,

  title,

  placeholder = "Enter value...",

  confirmText = "Save",

  initialValue = "",

  onConfirm,

  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (open) {
      // Reset the draft whenever the controlled modal is opened or retargeted.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setValue(initialValue);
    }
  }, [open, initialValue]);

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

        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (value.trim()) {
                onConfirm(value.trim());
              }
            }

            if (e.key === "Escape") {
              onCancel();
            }
          }}
          placeholder={placeholder}
          className="
            w-full

            mt-5

            px-4 py-3

            form-control rounded-xl
          "
        />

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <ActionButton
            onClick={() => {
              if (value.trim()) {
                onConfirm(value.trim());
              }
            }}
            variant="primary"
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
