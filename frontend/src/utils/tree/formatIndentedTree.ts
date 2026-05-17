import type { TreeNode } from "../../types/tree";

export type IndentedTreeNode = {
  id: number;

  name: string;

  depth: number;

  indentedName: string;
};

export function formatIndentedTree<T extends TreeNode<T>>(
  nodes: T[],
  depth = 0,
): IndentedTreeNode[] {
  let result: IndentedTreeNode[] = [];

  for (const node of nodes) {
    result.push({
      id: node.id,

      name: node.name,

      depth,

      indentedName: `${"— ".repeat(depth)}${node.name}`,
    });

    if (node.children?.length) {
      result = result.concat(formatIndentedTree(node.children, depth + 1));
    }
  }

  return result;
}
