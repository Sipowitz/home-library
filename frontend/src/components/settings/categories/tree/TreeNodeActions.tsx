import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

type Props = {
  label?: string;

  onAdd: () => void;

  onEdit: () => void;

  onDelete: () => void;
};

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;

  onClick: () => void;

  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();

        onClick();
      }}
      className="
        h-8 w-8
        rounded-lg

        bg-black/40
        hover:bg-black/70

        border border-white/10

        flex items-center justify-center

        text-gray-300
        hover:text-white

        transition
      "
    >
      {children}
    </button>
  );
}

export function TreeNodeActions({
  label = "node",
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function runMobileAction(action: () => void) {
    setMobileOpen(false);
    action();
  }

  return (
    <>
      <div className="relative shrink-0 lg:hidden">
        <button
          type="button"
          aria-label={`Actions for ${label}`}
          aria-expanded={mobileOpen}
          onClick={(event) => {
            event.stopPropagation();
            setMobileOpen((open) => !open);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-black/40 text-gray-200"
        >
          <MoreVertical size={20} aria-hidden="true" />
        </button>

        {mobileOpen && (
          <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-gray-700 bg-gray-950 shadow-xl">
            <button
              type="button"
              onClick={() => runMobileAction(onAdd)}
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-gray-200 hover:bg-gray-800"
            >
              <Plus size={16} aria-hidden="true" />
              Add child
            </button>
            <button
              type="button"
              onClick={() => runMobileAction(onEdit)}
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-gray-200 hover:bg-gray-800"
            >
              <Pencil size={16} aria-hidden="true" />
              Rename
            </button>
            <button
              type="button"
              onClick={() => runMobileAction(onDelete)}
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-red-300 hover:bg-gray-800"
            >
              <Trash2 size={16} aria-hidden="true" />
              Delete
            </button>
          </div>
        )}
      </div>

      <div
        className="
          hidden
          opacity-0
          group-hover:opacity-100

          transition-opacity

          lg:flex items-center gap-2
        "
      >
        <ActionButton label={`Add child to ${label}`} onClick={onAdd}>
          <Plus size={15} />
        </ActionButton>

        <ActionButton label={`Rename ${label}`} onClick={onEdit}>
          <Pencil size={15} />
        </ActionButton>

        <ActionButton label={`Delete ${label}`} onClick={onDelete}>
          <Trash2 size={15} />
        </ActionButton>
      </div>
    </>
  );
}
