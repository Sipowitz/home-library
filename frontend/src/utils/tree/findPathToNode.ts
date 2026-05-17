import type { TreeNode } from "../../types/tree";

export function findPathToNode<T extends TreeNode<T>>(
  nodes: T[],
  targetId: number,
): string[] {
  for (const node of nodes) {
    if (node.id === targetId) {
      return [node.name];
    }

    if (node.children?.length) {
      const childPath = findPathToNode(node.children, targetId);

      if (childPath.length) {
        return [node.name, ...childPath];
      }
    }
  }

  return [];
}
