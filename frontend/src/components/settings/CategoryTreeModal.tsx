// frontend/src/components/settings/CategoryTreeModal.tsx

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  useReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";

import "reactflow/dist/style.css";

import dagre from "dagre";

import { useEffect, useMemo, useRef, useState } from "react";

import type { Category } from "../../types/category";

type Props = {
  open: boolean;
  categories: Category[];
  onClose: () => void;
};

const NODE_WIDTH = 260;

const NODE_HEIGHT = 110;

const dagreGraph = new dagre.graphlib.Graph();

dagreGraph.setDefaultEdgeLabel(() => ({}));

// ================= HELPERS =================

function flattenCategories(categories: Category[]): Category[] {
  const result: Category[] = [];

  function walk(nodes: Category[]) {
    nodes.forEach((n) => {
      result.push(n);

      if (n.children?.length) {
        walk(n.children);
      }
    });
  }

  walk(categories);

  return result;
}

function findPathToNode(categories: Category[], targetId: number): number[] {
  for (const cat of categories) {
    if (cat.id === targetId) {
      return [cat.id];
    }

    if (cat.children?.length) {
      const childPath = findPathToNode(cat.children, targetId);

      if (childPath.length) {
        return [cat.id, ...childPath];
      }
    }
  }

  return [];
}

// ================= DEPTH STYLES =================

function getDepthStyles(depth: number) {
  if (depth === 0) {
    return {
      border: "border-purple-500/70",
      glow: "shadow-purple-900/50",
      bg: "from-purple-900/60 via-purple-950/70 to-black",
      line: "#a855f7",
    };
  }

  if (depth === 1) {
    return {
      border: "border-blue-500/60",
      glow: "shadow-blue-900/40",
      bg: "from-blue-900/40 via-slate-950 to-black",
      line: "#3b82f6",
    };
  }

  if (depth === 2) {
    return {
      border: "border-emerald-500/50",
      glow: "shadow-emerald-900/30",
      bg: "from-emerald-900/30 via-slate-950 to-black",
      line: "#10b981",
    };
  }

  return {
    border: "border-gray-600",
    glow: "shadow-black/40",
    bg: "from-gray-800/80 via-gray-950 to-black",
    line: "#6b7280",
  };
}

// ================= NODE =================

function CategoryNode({ data }: NodeProps) {
  const styles = getDepthStyles(data.depth);

  return (
    <div
      className={`
        min-w-[220px]
        rounded-2xl
        border
        bg-gradient-to-b
        shadow-2xl
        backdrop-blur-md
        transition-all duration-300
        hover:scale-[1.04]
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
        className="w-full px-6 py-5 text-center"
      >
        <div className="text-lg font-semibold text-white truncate">
          {data.name}
        </div>

        <div className="text-[11px] text-gray-300 mt-2 tracking-[0.18em] uppercase">
          {data.childCount} child
          {data.childCount !== 1 ? "ren" : ""}
        </div>
      </button>

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = {
  categoryNode: CategoryNode,
};

// ================= TREE =================

function buildTree(
  categories: Category[],
  focusedPath: number[],
  focusedId: number | null,
  onFocus: (id: number) => void,
  depth = 0,
  parentId?: string,
  nodes: Node[] = [],
  edges: Edge[] = [],
) {
  categories.forEach((cat) => {
    const id = String(cat.id);

    const styles = getDepthStyles(depth);

    const focused = focusedPath.includes(cat.id);

    const dimmed = focusedId !== null && !focused;

    nodes.push({
      id,

      type: "categoryNode",

      data: {
        id: cat.id,

        name: cat.name,

        depth,

        childCount: cat.children?.length || 0,

        focused,

        dimmed,

        onFocus,
      },

      position: {
        x: 0,
        y: 0,
      },
    });

    if (parentId) {
      edges.push({
        id: `${parentId}-${id}`,

        source: parentId,

        target: id,

        type: "smoothstep",

        animated: focused,

        style: {
          stroke: focused ? "#ffffff" : styles.line,

          strokeWidth: focused ? 3.2 : 2.2,

          opacity: dimmed ? 0.12 : 0.95,
        },
      });
    }

    if (cat.children?.length) {
      buildTree(
        cat.children,
        focusedPath,
        focusedId,
        onFocus,
        depth + 1,
        id,
        nodes,
        edges,
      );
    }
  });

  return {
    nodes,
    edges,
  };
}

// ================= LAYOUT =================

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  dagreGraph.setGraph({
    rankdir: "TB",

    ranksep: 120,

    nodesep: 80,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return {
    nodes: nodes.map((node) => {
      const pos = dagreGraph.node(node.id);

      return {
        ...node,

        position: {
          x: pos.x - NODE_WIDTH / 2,

          y: pos.y - NODE_HEIGHT / 2,
        },
      };
    }),

    edges,
  };
}

// ================= VIEWPORT CONTROLLER =================

function ViewportController({
  searchTargetId,
  focusedPath,
}: {
  searchTargetId: string | null;
  focusedPath: number[];
}) {
  const { fitView } = useReactFlow();

  const previousSearchRef = useRef<string | null>(null);

  // ================= SEARCH =================

  useEffect(() => {
    if (searchTargetId) {
      previousSearchRef.current = searchTargetId;

      setTimeout(() => {
        fitView({
          nodes: [
            {
              id: searchTargetId,
            },
          ],

          duration: 700,

          padding: 0.7,
        });
      }, 120);

      return;
    }

    // ================= SEARCH CLEARED =================

    if (previousSearchRef.current && !searchTargetId) {
      previousSearchRef.current = null;

      // Return to focused branch
      if (focusedPath.length > 0) {
        setTimeout(() => {
          fitView({
            nodes: focusedPath.map((id) => ({
              id: String(id),
            })),

            duration: 700,

            padding: 0.9,
          });
        }, 120);

        return;
      }

      // Return to overview
      setTimeout(() => {
        fitView({
          duration: 700,

          padding: 0.2,
        });
      }, 120);
    }
  }, [searchTargetId, focusedPath, fitView]);

  // ================= FOCUS =================

  useEffect(() => {
    if (focusedPath.length === 0) return;

    if (searchTargetId) return;

    setTimeout(() => {
      fitView({
        nodes: focusedPath.map((id) => ({
          id: String(id),
        })),

        duration: 700,

        padding: 0.9,
      });
    }, 120);
  }, [focusedPath, searchTargetId, fitView]);

  // ================= OVERVIEW =================

  useEffect(() => {
    if (focusedPath.length > 0) return;

    if (searchTargetId) return;

    setTimeout(() => {
      fitView({
        duration: 700,

        padding: 0.2,
      });
    }, 120);
  }, [focusedPath, searchTargetId, fitView]);

  return null;
}

// ================= COMPONENT =================

export function CategoryTreeModal({ open, categories, onClose }: Props) {
  const flatCategories = useMemo(
    () => flattenCategories(categories),
    [categories],
  );

  const [focusedId, setFocusedId] = useState<number | null>(null);

  const [search, setSearch] = useState("");

  const searchMatch = useMemo(() => {
    if (!search.trim()) return null;

    return flatCategories.find((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()),
    );
  }, [flatCategories, search]);

  const focusedPath = useMemo(() => {
    if (!focusedId) return [];

    return findPathToNode(categories, focusedId);
  }, [categories, focusedId]);

  const flow = useMemo(() => {
    const tree = buildTree(categories, focusedPath, focusedId, (id) =>
      setFocusedId((prev) => (prev === id ? null : id)),
    );

    return getLayoutedElements(tree.nodes, tree.edges);
  }, [categories, focusedPath, focusedId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 lg:p-6">
      <div className="w-full h-full bg-[#020617] border border-gray-800 rounded-3xl overflow-hidden flex flex-col shadow-[0_0_80px_rgba(0,0,0,0.75)]">
        {/* HEADER */}
        <div className="border-b border-gray-800 px-6 py-4 bg-[#030712]/95">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                Category Tree
              </h2>

              <p className="text-sm text-gray-400 mt-1">
                Interactive hierarchy explorer
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                placeholder="Search categories..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="
                  w-64
                  px-4 py-2
                  rounded-xl
                  bg-gray-900
                  border border-gray-700
                  text-sm
                  focus:outline-none
                  focus:border-purple-500
                "
              />

              <button
                onClick={onClose}
                className="
                  px-4 py-2 rounded-xl
                  bg-gray-800 hover:bg-gray-700
                  border border-gray-700
                  transition text-sm
                "
              >
                Close
              </button>
            </div>
          </div>

          {/* BREADCRUMB */}
          {focusedPath.length > 0 && (
            <div className="mt-4 text-sm text-gray-300">
              Focus:
              <span className="text-purple-300 ml-2">
                {focusedPath.join(" → ")}
              </span>
            </div>
          )}
        </div>

        {/* MOBILE */}
        <div className="lg:hidden flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {categories.map((cat) => (
              <MobileTreeNode key={cat.id} node={cat} />
            ))}
          </div>
        </div>

        {/* DESKTOP */}
        <div className="hidden lg:block flex-1">
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{
              padding: 0.2,
            }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            proOptions={{
              hideAttribution: true,
            }}
          >
            <ViewportController
              searchTargetId={searchMatch ? String(searchMatch.id) : null}
              focusedPath={focusedPath}
            />

            <Controls
              className="
                bg-gray-900
                border border-gray-700
                rounded-xl
                overflow-hidden
              "
            />

            <Background gap={28} size={1.2} color="#172036" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

// ================= MOBILE TREE =================

function MobileTreeNode({
  node,
  level = 0,
}: {
  node: Category;
  level?: number;
}) {
  return (
    <div>
      <div
        className="
          bg-gray-900
          border border-gray-800
          rounded-xl
          px-3 py-2
          text-sm
        "
        style={{
          marginLeft: `${level * 14}px`,
        }}
      >
        {node.name}
      </div>

      {node.children?.length > 0 && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <MobileTreeNode key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
