import type { TreeNode } from "../../types/tree";

export function findPathIdsToNode<T extends TreeNode<T>>(
  nodes: T[],
  targetId: number,
): number[] {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [node.id];
    }

    if (node.children?.length) {
      const childPath = findPathIdsToNode(node.children, targetId);

      if (childPath.length) {
        return [node.id, ...childPath];
      }
    }
  }

  return [];
}
