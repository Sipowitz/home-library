import type { TreeNode } from "../../types/tree";

export function getTreePath<T extends TreeNode<T>>(
  id: number | null | undefined,
  nodeMap: Map<number, T>,
  emptyLabel = "None selected",
): string {
  if (id === null || id === undefined) {
    return emptyLabel;
  }

  const path: string[] = [];

  let current = nodeMap.get(id);

  while (current) {
    path.unshift(current.name);

    current =
      current.parent_id != null ? nodeMap.get(current.parent_id) : undefined;
  }

  return path.join(" > ");
}
