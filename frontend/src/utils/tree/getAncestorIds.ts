import type { TreeNode } from "../../types/tree";

export function getAncestorIds<T extends TreeNode<T>>(
  id: number | null,
  nodeMap: Map<number, T>,
): number[] {
  if (id === null || id === -1) {
    return [];
  }

  const ancestors: number[] = [];

  let current = nodeMap.get(id);

  while (current?.parent_id != null) {
    ancestors.push(current.parent_id);

    current = nodeMap.get(current.parent_id);
  }

  return ancestors;
}
