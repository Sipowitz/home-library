import type { SeriesTreeNode } from "../../../types/series";

export type SeriesOption = {
  id: number;
  label: string;
};

export function flattenSeries(tree: SeriesTreeNode[]): SeriesTreeNode[] {
  return tree.flatMap((node) => [node, ...flattenSeries(node.children)]);
}

export function seriesOptions(
  tree: SeriesTreeNode[],
  excludedIds: Set<number> = new Set(),
): SeriesOption[] {
  const result: SeriesOption[] = [];

  function visit(nodes: SeriesTreeNode[], path: string[]) {
    nodes.forEach((node) => {
      const nextPath = [...path, node.name];
      if (!excludedIds.has(node.id)) {
        result.push({ id: node.id, label: nextPath.join(" › ") });
      }
      visit(node.children, nextPath);
    });
  }

  visit(tree, []);
  return result;
}

export function descendantIds(node: SeriesTreeNode): Set<number> {
  const result = new Set<number>();

  function visit(current: SeriesTreeNode) {
    current.children.forEach((child) => {
      result.add(child.id);
      visit(child);
    });
  }

  visit(node);
  return result;
}

export type SeriesFlowItem = SeriesTreeNode & {
  child_count: number;
  stats: Record<string, never>;
  children: SeriesFlowItem[];
};

export function toSeriesFlowItems(tree: SeriesTreeNode[]): SeriesFlowItem[] {
  return tree.map((node) => ({
    ...node,
    child_count: node.children.length,
    stats: {},
    children: toSeriesFlowItems(node.children),
  }));
}
