import type { Edge, Node } from "reactflow";

import dagre from "dagre";

import { flattenTree } from "../../../utils/tree/flattenTree";
import { findPathIdsToNode } from "../../../utils/tree/findPathIdsToNode";
import { findPathToNode } from "../../../utils/tree/findPathToNode";

const NODE_WIDTH = 260;

const NODE_HEIGHT = 170;

// ================= RE-EXPORT SHARED TREE UTILS =================

export { flattenTree, findPathIdsToNode, findPathToNode };

// ================= BUILD TREE =================

export function buildTreeElements<
  T extends {
    id: number;

    name: string;

    children?: T[];

    child_count: number;

    stats: {
      total_books?: number;

      read_books?: number;

      unread_books?: number;
    };
  },
>(
  categories: T[],

  focusedPath: number[],

  focusedId: number | null,

  onFocus: (id: number) => void,

  onRename: (id: number, name: string) => Promise<void>,

  onAddChild: (parentId: number, name: string) => Promise<void>,

  onDelete: (id: number, cascade?: boolean) => Promise<any>,

  nodeType = "categoryNode",

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

      type: nodeType,

      data: {
        id: category.id,

        name: category.name,

        depth,

        childCount: category.child_count,

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

        pathOptions:
          nodeType === "locationNode" ? { borderRadius: 0 } : undefined,

        animated: focused,

        style: {
          stroke: focused
            ? "rgba(255,255,255,0.95)"
            : depth === 0
              ? "rgba(192,132,252,0.75)"
              : depth === 1
                ? "rgba(96,165,250,0.62)"
                : depth === 2
                  ? "rgba(52,211,153,0.52)"
                  : "rgba(148,163,184,0.38)",

          strokeWidth: focused ? 3 : 2.2,

          opacity: dimmed ? 0.08 : 0.92,
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

        nodeType,

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

function alignParentCentersToChildren(nodes: Node[], edges: Edge[]) {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childIdsByParent = new Map<string, string[]>();

  edges.forEach((edge) => {
    const childIds = childIdsByParent.get(edge.source) ?? [];

    childIds.push(edge.target);
    childIdsByParent.set(edge.source, childIds);
  });

  const deepestNodesFirst = [...nodes].sort(
    (first, second) => second.position.y - first.position.y,
  );

  deepestNodesFirst.forEach((parent) => {
    const childCenters = (childIdsByParent.get(parent.id) ?? [])
      .map((childId) => nodeById.get(childId))
      .filter((child): child is Node => Boolean(child))
      .map((child) => child.position.x)
      .sort((first, second) => first - second);

    if (childCenters.length === 0) return;

    const middleIndex = Math.floor(childCenters.length / 2);
    const trunkX =
      childCenters.length % 2 === 1
        ? childCenters[middleIndex]
        : (childCenters[middleIndex - 1] + childCenters[middleIndex]) / 2;

    parent.position = {
      ...parent.position,
      x: trunkX,
    };
  });

  return nodes;
}

export function getLayoutedElements(
  nodes: Node[],

  edges: Edge[],

  alignParentsToChildren = false,
) {
  const dagreGraph = new dagre.graphlib.Graph();

  dagreGraph.setDefaultEdgeLabel(() => ({}));

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

  const layoutedNodes = nodes.map((node) => {
    const position = dagreGraph.node(node.id);

    return {
      ...node,

      position: {
        x: alignParentsToChildren ? position.x : position.x - NODE_WIDTH / 2,

        y: position.y - NODE_HEIGHT / 2,
      },
    };
  });

  return {
    nodes: alignParentsToChildren
      ? alignParentCentersToChildren(layoutedNodes, edges)
      : layoutedNodes,

    edges,
  };
}
