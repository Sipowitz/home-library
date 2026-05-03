import dagre from "dagre";

import type { Edge, Node } from "reactflow";

import type { Category } from "../../../types/category";

export const NODE_WIDTH = 300;

export const NODE_HEIGHT = 175;

const dagreGraph = new dagre.graphlib.Graph();

dagreGraph.setDefaultEdgeLabel(() => ({}));

// ================= FLATTEN =================

export function flattenCategories(categories: Category[]): Category[] {
  const result: Category[] = [];

  function walk(nodes: Category[]) {
    nodes.forEach((node) => {
      result.push(node);

      if (node.children?.length) {
        walk(node.children);
      }
    });
  }

  walk(categories);

  return result;
}

// ================= FIND PATH =================

export function findPathToNode(
  categories: Category[],
  targetId: number,
): number[] {
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

export function getDepthStyles(depth: number) {
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

// ================= BUILD TREE =================

export function buildTree(
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

        stats: cat.stats,

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

export function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  dagreGraph.setGraph({
    rankdir: "TB",

    ranksep: 140,

    nodesep: 100,
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
