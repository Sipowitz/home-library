import { useEffect, useState } from "react";

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
            onClick={() => {
              if (value.trim()) {
                onConfirm(value.trim());
              }
            }}
            className="
              px-4 py-2

              rounded-xl

              bg-purple-600
              hover:bg-purple-500

              transition
            "
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
