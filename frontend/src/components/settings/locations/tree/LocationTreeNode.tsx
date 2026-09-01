import { useState } from "react";
import { createPortal } from "react-dom";
import { Handle, Position, type NodeProps } from "reactflow";

import { TreeConfirmModal } from "../../categories/tree/TreeConfirmModal";
import { TreeInputModal } from "../../categories/tree/TreeInputModal";
import { TreeNodeActions } from "../../categories/tree/TreeNodeActions";
import { getDepthStyles } from "../../categories/tree/treeStyles";

export function LocationTreeNode({ data }: NodeProps) {
  const styles = getDepthStyles(data.depth);
  const [renaming, setRenaming] = useState(false);
  const [creatingChild, setCreatingChild] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleRename(name: string) {
    try {
      await data.onRename(data.id, name);
      setRenaming(false);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreateChild(name: string) {
    try {
      await data.onAddChild(data.id, name);
      setCreatingChild(false);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleDelete() {
    try {
      await data.onDelete(data.id);
      setConfirmingDelete(false);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <>
      <div
        className={`
          group relative flex h-10 w-[150px] items-center rounded-lg border
          bg-gradient-to-b transition-all duration-300 ease-out
          hover:scale-[1.02]
          ${styles.border}
          ${styles.bg}
          ${data.dimmed ? "opacity-60" : "opacity-100"}
          ${data.focused ? "ring-2 ring-blue-500/70 dark:ring-1 dark:ring-white/30" : ""}
        `}
      >
        <Handle type="target" position={Position.Left} className="opacity-0" />

        <button
          type="button"
          onClick={() => data.onFocus(data.id)}
          className="flex h-full min-w-0 flex-1 items-center gap-2 px-2.5 text-left focus-visible:outline-none"
          title={data.name}
        >
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary">
            {data.name}
          </span>
          <span
            className="shrink-0 text-[10px] tabular-nums text-text-muted"
            title={`${data.stats.total_books} books · ${data.childCount} child locations`}
          >
            {data.stats.total_books} · {data.childCount}
          </span>
        </button>

        <div className="pointer-events-none absolute left-[calc(100%-4px)] top-1/2 z-20 -translate-y-1/2 rounded-lg border border-border bg-surface/95 p-1 opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <TreeNodeActions
            label={data.name}
            onAdd={() => setCreatingChild(true)}
            onEdit={() => setRenaming(true)}
            onDelete={() => setConfirmingDelete(true)}
          />
        </div>

        <Handle type="source" position={Position.Right} className="opacity-0" />
      </div>

      {createPortal(
        <>
          <TreeInputModal
            open={renaming}
            title={`Rename ${data.name}`}
            initialValue={data.name}
            confirmText="Rename"
            onConfirm={(name) => void handleRename(name)}
            onCancel={() => setRenaming(false)}
          />
          <TreeInputModal
            open={creatingChild}
            title={`Add child to ${data.name}`}
            placeholder="New child location..."
            confirmText="Add Location"
            onConfirm={(name) => void handleCreateChild(name)}
            onCancel={() => setCreatingChild(false)}
          />
          <TreeConfirmModal
            open={confirmingDelete}
            title={`Delete ${data.name}?`}
            message="Delete this location?"
            confirmText="Delete"
            danger
            onConfirm={() => void handleDelete()}
            onCancel={() => setConfirmingDelete(false)}
          />
        </>,
        document.body,
      )}
    </>
  );
}
