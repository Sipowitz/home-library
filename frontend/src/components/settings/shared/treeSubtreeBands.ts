import type { Edge, Node } from "reactflow";

export type TreeSubtreeBandOptions = {
  nodeHeight: number;
  siblingGap: number;
  rootGap: number;
};

export function applyTreeSubtreeBands(
  nodes: Node[],
  edges: Edge[],
  options: TreeSubtreeBandOptions,
): Node[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childrenByParent = new Map<string, string[]>();
  const childIds = new Set<string>();

  edges.forEach((edge) => {
    if (!nodeById.has(edge.source) || !nodeById.has(edge.target)) return;
    const children = childrenByParent.get(edge.source) ?? [];
    children.push(edge.target);
    childrenByParent.set(edge.source, children);
    childIds.add(edge.target);
  });

  const subtreeHeights = new Map<string, number>();

  function measureSubtree(nodeId: string): number {
    const measured = subtreeHeights.get(nodeId);
    if (measured !== undefined) return measured;

    const children = childrenByParent.get(nodeId) ?? [];
    const childrenHeight = children.reduce(
      (height, childId) => height + measureSubtree(childId),
      Math.max(0, children.length - 1) * options.siblingGap,
    );
    const height = Math.max(options.nodeHeight, childrenHeight);
    subtreeHeights.set(nodeId, height);
    return height;
  }

  const yById = new Map<string, number>();
  const positioned = new Set<string>();

  function positionSubtree(nodeId: string, bandTop: number) {
    const subtreeHeight = measureSubtree(nodeId);
    const children = childrenByParent.get(nodeId) ?? [];

    if (children.length === 0) {
      yById.set(nodeId, bandTop + (subtreeHeight - options.nodeHeight) / 2);
      positioned.add(nodeId);
      return;
    }

    const childrenHeight = children.reduce(
      (height, childId) => height + measureSubtree(childId),
      Math.max(0, children.length - 1) * options.siblingGap,
    );
    let childBandTop = bandTop + (subtreeHeight - childrenHeight) / 2;

    children.forEach((childId) => {
      positionSubtree(childId, childBandTop);
      childBandTop += measureSubtree(childId) + options.siblingGap;
    });

    yById.set(nodeId, bandTop + (subtreeHeight - options.nodeHeight) / 2);
    positioned.add(nodeId);
  }

  let nextRootTop = 0;
  const roots = nodes.filter((node) => !childIds.has(node.id));

  function positionRoot(nodeId: string) {
    positionSubtree(nodeId, nextRootTop);
    nextRootTop += measureSubtree(nodeId) + options.rootGap;
  }

  roots.forEach((root) => positionRoot(root.id));
  nodes.forEach((node) => {
    if (!positioned.has(node.id)) positionRoot(node.id);
  });

  return nodes.map((node) => ({
    ...node,
    position: {
      ...node.position,
      y: yById.get(node.id) ?? node.position.y,
    },
  }));
}
