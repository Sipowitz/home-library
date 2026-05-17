// frontend/src/components/settings/locations/tree/LocationTreeNode.tsx

import { Handle, Position, type NodeProps } from "reactflow";

import { useEffect, useState } from "react";

import { getDepthStyles } from "../../categories/tree/treeStyles";

import { TreeNodeActions } from "../../categories/tree/TreeNodeActions";

export function LocationTreeNode({ data }: NodeProps) {
  const styles = getDepthStyles(data.depth);

  // ================= RENAME =================

  const [editing, setEditing] = useState(false);

  const [name, setName] = useState(data.name);

  // ================= CREATE CHILD =================

  const [creatingChild, setCreatingChild] = useState(false);

  const [childName, setChildName] = useState("");

  // ================= DELETE =================

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    setName(data.name);
  }, [data.name]);

  // ================= RENAME =================

  async function handleRename() {
    if (!name.trim()) {
      setName(data.name);

      setEditing(false);

      return;
    }

    try {
      await data.onRename(data.id, name.trim());

      setEditing(false);
    } catch (err) {
      console.error(err);

      setName(data.name);

      setEditing(false);
    }
  }

  // ================= CREATE CHILD =================

  async function handleCreateChild() {
    if (!childName.trim()) {
      setCreatingChild(false);

      setChildName("");

      return;
    }

    try {
      await data.onAddChild(data.id, childName.trim());

      setCreatingChild(false);

      setChildName("");
    } catch (err) {
      console.error(err);
    }
  }

  // ================= DELETE =================

  async function handleDelete() {
    try {
      await data.onDelete(data.id);

      setConfirmingDelete(false);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div
      className={`
        group

        min-w-[260px]

        rounded-2xl
        border

        bg-gradient-to-b

        transition-all
        duration-300
        ease-out

        hover:scale-[1.02]

        ${styles.border}
        ${styles.bg}

        ${data.dimmed ? "opacity-60" : "opacity-100"}

        ${data.focused ? "ring-1 ring-white/30" : ""}
      `}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <div
        className="
          w-full
          px-5
          py-5
          text-left
        "
      >
        {/* HEADER */}
        <div className="flex items-start justify-between gap-4">
          <button
            onClick={() => data.onFocus(data.id)}
            className="min-w-0 flex-1 text-left"
          >
            {/* TITLE */}
            {editing ? (
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRename();
                  }

                  if (e.key === "Escape") {
                    setName(data.name);

                    setEditing(false);
                  }
                }}
                className="
                  w-full

                  bg-black/30

                  border border-white/10

                  rounded-lg

                  px-3 py-2

                  text-white
                  text-lg
                  font-semibold

                  outline-none
                "
              />
            ) : (
              <div className="text-lg font-semibold text-white truncate">
                {data.name}
              </div>
            )}

            <div className="text-[11px] text-gray-300 mt-2 tracking-[0.16em] uppercase">
              {data.childCount} child
              {data.childCount !== 1 ? "ren" : ""}
            </div>
          </button>

          {/* ACTIONS */}
          {!confirmingDelete && (
            <TreeNodeActions
              onAdd={() => setCreatingChild(true)}
              onEdit={() => setEditing(true)}
              onDelete={() => setConfirmingDelete(true)}
            />
          )}
        </div>

        {/* CREATE CHILD */}
        <div
          className={`
            overflow-hidden

            transition-all
            duration-300
            ease-out

            ${
              creatingChild
                ? "max-h-24 opacity-100 mt-4"
                : "max-h-0 opacity-0 mt-0"
            }
          `}
        >
          <input
            autoFocus
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="New child location..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleCreateChild();
              }

              if (e.key === "Escape") {
                setCreatingChild(false);

                setChildName("");
              }
            }}
            className="
              w-full

              px-3 py-2

              rounded-xl

              bg-black/30

              border border-white/10

              text-sm text-white

              outline-none

              focus:border-purple-500
            "
          />
        </div>

        {/* DELETE CONFIRM */}
        <div
          className={`
            overflow-hidden

            transition-all
            duration-300
            ease-out

            ${
              confirmingDelete
                ? "max-h-40 opacity-100 mt-4"
                : "max-h-0 opacity-0 mt-0"
            }
          `}
        >
          <div
            className="
              rounded-xl

              border border-red-500/20

              bg-red-500/10

              p-4
            "
          >
            <div className="text-sm text-red-200">Delete this location?</div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setConfirmingDelete(false)}
                className="
                  flex-1

                  px-3 py-2

                  rounded-lg

                  bg-gray-800
                  hover:bg-gray-700

                  text-sm

                  transition
                "
              >
                Cancel
              </button>

              <button
                onClick={handleDelete}
                className="
                  flex-1

                  px-3 py-2

                  rounded-lg

                  bg-red-600
                  hover:bg-red-500

                  text-sm

                  transition
                "
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
