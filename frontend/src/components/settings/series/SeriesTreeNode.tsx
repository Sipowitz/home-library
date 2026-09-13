import { FolderTree, GitBranch, GitBranchPlus, Pencil, Trash2 } from "lucide-react";
import { Handle, Position, type NodeProps } from "reactflow";

import { AnchoredTreeNodeActions } from "../categories/tree/AnchoredTreeNodeActions";
import { getDepthStyles } from "../categories/tree/treeStyles";
import { ActionButton } from "../../ui/ActionButton";
import { SeriesBookTreeNode } from "./SeriesBookTreeNode";

export function SeriesTreeNode({ data }: NodeProps) {
  if (data.bookLeaf) return <SeriesBookTreeNode data={data} />;

  const styles = getDepthStyles(data.depth);
  const isGroup = data.nodeType === "group";
  return (
    <AnchoredTreeNodeActions
      label={data.name}
      onAdd={() => void data.onAddChild(data.id, "")}
      onEdit={() => void data.onRename(data.id, data.name)}
      onDelete={() => void data.onDelete(data.id)}
      actions={(closeAndRun) => (
        <div className="flex flex-col p-1">
          <SeriesNodeAction label="Add Series" icon={<GitBranchPlus size={15} />} onClick={() => closeAndRun(() => void data.onAddChild(data.id, ""))} />
          <SeriesNodeAction label={`Edit ${isGroup ? "Group" : "Series"}`} icon={<Pencil size={15} />} onClick={() => closeAndRun(() => void data.onRename(data.id, data.name))} />
          <SeriesNodeAction label={`Delete ${isGroup ? "Group" : "Series"}`} danger icon={<Trash2 size={15} />} onClick={() => closeAndRun(() => void data.onDelete(data.id))} />
        </div>
      )}
    >
      <div
        className={`
          group relative flex h-10 w-[150px] items-center rounded-lg border
          bg-gradient-to-b transition-all duration-300 ease-out
          hover:scale-[1.02]
          ${styles.border}
          ${styles.bg}
          ${data.dimmed ? "opacity-60" : "opacity-100"}
          ${data.selected ? "ring-2 ring-focus/70" : ""}
        `}
      >
        <Handle type="target" position={Position.Left} className="opacity-0" />

        <button
          type="button"
          onClick={() => data.onFocus(data.id)}
          aria-pressed={data.selected}
          aria-label={`Select ${isGroup ? "Group" : "Series"} ${data.name}`}
          className="flex h-full min-w-0 flex-1 items-center gap-2 px-2.5 text-left focus-visible:outline-none"
          title={data.name}
        >
          <span className="shrink-0 text-text-muted" title={isGroup ? "Group" : "Series"}>{isGroup ? <FolderTree size={14} /> : <GitBranch size={14} />}</span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
            {data.name}
          </span>
        </button>

        <Handle type="source" position={Position.Right} className="opacity-0" />
      </div>
    </AnchoredTreeNodeActions>
  );
}

function SeriesNodeAction({ label, icon, danger = false, onClick }: { label: string; icon: React.ReactNode; danger?: boolean; onClick: () => void }) {
  return (
    <ActionButton
      variant="tertiary"
      size="sm"
      className={`justify-start whitespace-nowrap ${danger ? "text-danger" : "text-text-secondary"}`}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {icon} {label}
    </ActionButton>
  );
}
