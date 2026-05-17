import type { TreeNode } from "../../types/tree";

export function flattenTree<T extends TreeNode<T>>(nodes: T[]): T[] {
  const result: T[] = [];

  function walk(items: T[]) {
    items.forEach((item) => {
      result.push(item);

      if (item.children?.length) {
        walk(item.children);
      }
    });
  }

  walk(nodes);

  return result;
}
