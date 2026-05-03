import type { Edge, Node } from "reactflow";

import dagre from "dagre";

import type { Category } from "../../../types/category";

const NODE_WIDTH = 260;

const NODE_HEIGHT = 170;

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
  for (const category of categories) {
    if (category.id === targetId) {
      return [category.id];
    }

    if (category.children?.length) {
      const childPath = findPathToNode(category.children, targetId);

      if (childPath.length) {
        return [category.id, ...childPath];
      }
    }
  }

  return [];
}

// ================= BUILD TREE =================

export function buildTreeElements(
  categories: Category[],

  focusedPath: number[],

  focusedId: number | null,

  onFocus: (id: number) => void,

  onRename: (id: number, name: string) => Promise<void>,

  onAddChild: (parentId: number, name: string) => Promise<void>,

  onDelete: (id: number, cascade?: boolean) => Promise<any>,

  depth = 0,

  parentId?: string,

  nodes: Node[] = [],

  edges: Edge[] = [],
) {
  categories.forEach((category) => {
    const id = String(category.id);

    const focused = focusedPath.includes(category.id);

    const dimmed = focusedId !== null && !focused;

    nodes.push({
      id,

      type: "categoryNode",

      data: {
        id: category.id,

        name: category.name,

        depth,

        childCount: category.children?.length || 0,

        stats: {
          total_books: category.stats?.total_books || 0,

          read_books: category.stats?.read_books || 0,

          unread_books: category.stats?.unread_books || 0,
        },

        focused,

        dimmed,

        onFocus,

        onRename,

        onAddChild,

        onDelete,
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
          stroke: focused
            ? "#ffffff"
            : depth === 0
              ? "#a855f7"
              : depth === 1
                ? "#3b82f6"
                : depth === 2
                  ? "#10b981"
                  : "#6b7280",

          strokeWidth: focused ? 3.2 : 2.2,

          opacity: dimmed ? 0.12 : 0.95,
        },
      });
    }

    if (category.children?.length) {
      buildTreeElements(
        category.children,

        focusedPath,

        focusedId,

        onFocus,

        onRename,

        onAddChild,

        onDelete,

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

export function getLayoutedElements(
  nodes: Node[],

  edges: Edge[],
) {
  dagreGraph.setGraph({
    rankdir: "TB",

    ranksep: 170,

    nodesep: 90,
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
      const position = dagreGraph.node(node.id);

      return {
        ...node,

        position: {
          x: position.x - NODE_WIDTH / 2,

          y: position.y - NODE_HEIGHT / 2,
        },
      };
    }),

    edges,
  };
}
