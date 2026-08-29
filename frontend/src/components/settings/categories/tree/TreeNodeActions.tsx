import { MoreVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ActionButton } from "../../../ui/ActionButton";

type Props = {
  label?: string;

  onAdd: () => void;

  onEdit: () => void;

  onDelete: () => void;
};

function TreeIconButton({
  label,
  onClick,
  children,
}: {
  label: string;

  onClick: () => void;

  children: React.ReactNode;
}) {
  return (
    <ActionButton
      variant="icon"
      size="iconSm"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();

        onClick();
      }}
    >
      {children}
    </ActionButton>
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
        <ActionButton
          variant="icon"
          size="icon"
          aria-label={`Actions for ${label}`}
          aria-expanded={mobileOpen}
          onClick={(event) => {
            event.stopPropagation();
            setMobileOpen((open) => !open);
          }}
        >
          <MoreVertical size={20} aria-hidden="true" />
        </ActionButton>

        {mobileOpen && (
          <div className="absolute right-0 top-11 z-20 w-40 overflow-hidden rounded-xl border border-border-strong bg-surface shadow-xl">
            <button
              type="button"
              onClick={() => runMobileAction(onAdd)}
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-text-secondary hover:bg-surface-muted"
            >
              <Plus size={16} aria-hidden="true" />
              Add child
            </button>
            <button
              type="button"
              onClick={() => runMobileAction(onEdit)}
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-text-secondary hover:bg-surface-muted"
            >
              <Pencil size={16} aria-hidden="true" />
              Rename
            </button>
            <button
              type="button"
              onClick={() => runMobileAction(onDelete)}
              className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-danger hover:bg-surface-muted"
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
        <TreeIconButton label={`Add child to ${label}`} onClick={onAdd}>
          <Plus size={15} />
        </TreeIconButton>

        <TreeIconButton label={`Rename ${label}`} onClick={onEdit}>
          <Pencil size={15} />
        </TreeIconButton>

        <TreeIconButton label={`Delete ${label}`} onClick={onDelete}>
          <Trash2 size={15} />
        </TreeIconButton>
      </div>
    </>
  );
}
