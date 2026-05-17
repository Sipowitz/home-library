import type { TreeNode } from "../../types/tree";

export function buildTreeMap<T extends TreeNode<T>>(
  nodes: T[],
  map = new Map<number, T>(),
): Map<number, T> {
  for (const node of nodes) {
    map.set(node.id, node);

    if (node.children?.length) {
      buildTreeMap(node.children, map);
    }
  }

  return map;
}
