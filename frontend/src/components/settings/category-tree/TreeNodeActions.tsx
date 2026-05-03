import { Pencil, Plus, Trash2 } from "lucide-react";

type Props = {
  onAdd: () => void;

  onEdit: () => void;

  onDelete: () => void;
};

function ActionButton({
  onClick,
  children,
}: {
  onClick: () => void;

  children: React.ReactNode;
}) {
  return (
    <button
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

export function TreeNodeActions({ onAdd, onEdit, onDelete }: Props) {
  return (
    <div
      className="
        opacity-0
        group-hover:opacity-100

        transition-opacity

        flex items-center gap-2
      "
    >
      <ActionButton onClick={onAdd}>
        <Plus size={15} />
      </ActionButton>

      <ActionButton onClick={onEdit}>
        <Pencil size={15} />
      </ActionButton>

      <ActionButton onClick={onDelete}>
        <Trash2 size={15} />
      </ActionButton>
    </div>
  );
}
