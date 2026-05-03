import { Handle, Position, type NodeProps } from "reactflow";

import { getDepthStyles } from "./categoryTreeUtils";

// ================= STAT BADGE =================

function StatBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className={`
        rounded-xl
        border
        px-3
        py-2
        bg-black/20
        backdrop-blur-sm
        ${color}
      `}
    >
      <div className="text-[10px] uppercase tracking-[0.16em] text-gray-400">
        {label}
      </div>

      <div className="text-lg font-semibold text-white mt-1">{value}</div>
    </div>
  );
}

// ================= NODE =================

export function CategoryTreeNode({ data }: NodeProps) {
  const styles = getDepthStyles(data.depth);

  return (
    <div
      className={`
        min-w-[260px]
        rounded-2xl
        border
        bg-gradient-to-b
        shadow-2xl
        backdrop-blur-md
        transition-all duration-300
        hover:scale-[1.03]
        hover:brightness-110
        ${styles.border}
        ${styles.glow}
        ${styles.bg}
        ${data.dimmed ? "opacity-20 scale-95" : "opacity-100"}
        ${data.focused ? "ring-2 ring-white/50" : ""}
      `}
    >
      <Handle type="target" position={Position.Top} className="opacity-0" />

      <button
        onClick={() => data.onFocus(data.id)}
        className="w-full px-5 py-5 text-left"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold text-white truncate">
              {data.name}
            </div>

            <div className="text-[11px] text-gray-300 mt-2 tracking-[0.18em] uppercase">
              {data.childCount} child
              {data.childCount !== 1 ? "ren" : ""}
            </div>
          </div>

          <div className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-gray-200">
            #{data.id}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          <StatBadge
            label="Total"
            value={data.stats.total_books}
            color="border-blue-500/30"
          />

          <StatBadge
            label="Read"
            value={data.stats.read_books}
            color="border-emerald-500/30"
          />

          <StatBadge
            label="Unread"
            value={data.stats.unread_books}
            color="border-amber-500/30"
          />
        </div>
      </button>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}
