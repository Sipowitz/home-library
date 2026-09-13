import type { EffectiveSeriesBook, SeriesTreeNode } from "../../../types/series";

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

export type SeriesFlowItem = {
  id: number;
  name: string;
  child_count: number;
  stats: Record<string, never>;
  children: SeriesFlowItem[];
  flowId?: string;
  flowData?: Record<string, unknown>;
  preserveVisibility?: boolean;
};

export type SeriesBookLeafSelection = {
  leafId: string;
  bookId: number;
  seriesId: number;
};

export type SeriesTreeOrder = "publication" | "chronological" | "reading";

export function seriesBookLeafId(seriesId: number, bookId: number) {
  return `series-${seriesId}-book-${bookId}`;
}

function compareBookLeaves(
  left: { title: string; order: number | null },
  right: { title: string; order: number | null },
) {
  const leftOrder = left.order;
  const rightOrder = right.order;
  if (leftOrder !== null && rightOrder !== null && leftOrder !== rightOrder) {
    return leftOrder < rightOrder ? -1 : 1;
  }
  if (leftOrder !== null && rightOrder === null) return -1;
  if (leftOrder === null && rightOrder !== null) return 1;
  return left.title.localeCompare(right.title, undefined, { sensitivity: "base" });
}

export function toSeriesFlowItems(
  tree: SeriesTreeNode[],
  effectiveBooks: EffectiveSeriesBook[] = [],
  selectedBookLeafId: string | null = null,
  onSelectBook?: (selection: SeriesBookLeafSelection) => void,
  onAddBook?: (seriesId: number) => void,
  onManageBooks?: (seriesId: number) => void,
  order: SeriesTreeOrder = "publication",
): SeriesFlowItem[] {
  const parentBySeries = new Map<number, number | null>();

  function indexParents(nodes: SeriesTreeNode[]) {
    nodes.forEach((node) => {
      parentBySeries.set(node.id, node.parent_id);
      indexParents(node.children);
    });
  }

  indexParents(tree);

  const booksBySeries = new Map<number, Array<{
    book: EffectiveSeriesBook;
    order: number | null;
  }>>();

  effectiveBooks.forEach((book) => {
    const membershipIds = new Set(book.explicit_memberships.map((membership) => membership.series_id));
    const displayMemberships = book.explicit_memberships.filter((membership) => {
      for (const candidateId of membershipIds) {
        let parentId = parentBySeries.get(candidateId) ?? null;
        while (parentId !== null) {
          if (parentId === membership.series_id) return false;
          parentId = parentBySeries.get(parentId) ?? null;
        }
      }
      return true;
    });

    displayMemberships.forEach((membership) => {
      const memberships = booksBySeries.get(membership.series_id) ?? [];
      const position = order === "chronological"
        ? book.chronological_order
        : order === "reading"
          ? book.reading_order
          : book.publication_order;
      memberships.push({ book, order: position });
      booksBySeries.set(membership.series_id, memberships);
    });
  });

  return tree.map((node) => ({
    id: node.id,
    name: node.name,
    child_count: node.children.length,
    stats: {},
    flowData: {
      nodeType: node.node_type,
      onAddBook: () => onAddBook?.(node.id),
      onManageBooks: () => onManageBooks?.(node.id),
    },
    children: [
      ...toSeriesFlowItems(node.children, effectiveBooks, selectedBookLeafId, onSelectBook, onAddBook, onManageBooks, order),
      ...(booksBySeries.get(node.id) ?? [])
        .sort((left, right) => compareBookLeaves(
          { title: left.book.title, order: left.order },
          { title: right.book.title, order: right.order },
        ))
        .map(({ book }) => {
          const leafId = seriesBookLeafId(node.id, book.book_id);
          return {
          id: book.book_id,
          flowId: leafId,
          name: book.title,
          child_count: 0,
          stats: {},
          children: [],
          preserveVisibility: true,
          flowData: {
            bookLeaf: true,
            coverUrl: book.cover_url,
            selected: selectedBookLeafId === leafId,
            onSelectBook: () => onSelectBook?.({
              leafId,
              bookId: book.book_id,
              seriesId: node.id,
            }),
          },
        };
        }),
    ],
  }));
}
