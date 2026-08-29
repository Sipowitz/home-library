import type { LibraryViewMode } from "../../../types/preferences";

type Props = {
  value: LibraryViewMode;

  onChange: (mode: LibraryViewMode) => void;
};

export function ViewModeSwitcher({ value, onChange }: Props) {
  return (
    <div
      className="
        flex items-center
        gap-1
        p-1
        rounded-2xl
        border border-border
        bg-surface/70
        backdrop-blur-sm
        w-fit
      "
    >
      <button
        type="button"
        onClick={() => {
          onChange("grid");
        }}
        className={`
          px-4 py-2
          rounded-xl
          text-sm
          transition
          ${
            value === "grid"
              ? "bg-blue-600 text-white shadow"
              : "text-text-secondary hover:bg-control hover:text-text-primary"
          }
        `}
      >
        Grid
      </button>

      <button
        type="button"
        onClick={() => {
          onChange("list");
        }}
        className={`
          px-4 py-2
          rounded-xl
          text-sm
          transition
          ${
            value === "list"
              ? "bg-blue-600 text-white shadow"
              : "text-text-secondary hover:bg-control hover:text-text-primary"
          }
        `}
      >
        List
      </button>
    </div>
  );
}
