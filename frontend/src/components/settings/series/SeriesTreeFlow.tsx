import { useCallback, useMemo } from "react";

import { BaseTreeFlow } from "../shared/BaseTreeFlow";
import { findPathIdsToNode, type TreeLayoutOptions } from "../shared/treeLayout";

import type { EffectiveSeriesBook, SeriesTreeNode as SeriesTreeNodeType } from "../../../types/series";

import { SeriesTreeNode } from "./SeriesTreeNode";
import { toSeriesFlowItems, type SeriesBookLeafSelection, type SeriesTreeOrder } from "./seriesTree";

type Props = {
  series: SeriesTreeNodeType[];
  books?: EffectiveSeriesBook[];
  order: SeriesTreeOrder;
  selectedId: number | null;
  selectedBookLeafId: string | null;
  onSelect: (id: number | null) => void;
  onSelectBook: (selection: SeriesBookLeafSelection) => void;
  onAddBook: (seriesId: number) => void;
  onManageBooks: (seriesId: number) => void;
  searchTargetId: string | null;
  onAdd: (parentId: number) => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
};

const compactSeriesLayout = {
  nodeWidth: 150,
  nodeHeight: 40,
  nodesep: 24,
  ranksep: 64,
  rankdir: "LR",
  subtreeBands: {
    nodeHeight: 40,
    siblingGap: 20,
    rootGap: 40,
  },
} satisfies TreeLayoutOptions;

export function SeriesTreeFlow({ series, books = [], order, selectedId, selectedBookLeafId, onSelect, onSelectBook, onAddBook, onManageBooks, searchTargetId, onAdd, onEdit, onDelete }: Props) {
  const items = useMemo(
    () => toSeriesFlowItems(series, books, selectedBookLeafId, onSelectBook, onAddBook, onManageBooks, order),
    [books, onAddBook, onManageBooks, onSelectBook, order, selectedBookLeafId, series],
  );
  const selectedPath = useMemo(
    () => (selectedId === null ? [] : findPathIdsToNode(series, selectedId)),
    [selectedId, series],
  );
  const handleFocus = useCallback(
    (id: number) => onSelect(id === -1 ? null : id),
    [onSelect],
  );

  return (
    <BaseTreeFlow
      items={items}
      focusedId={selectedId}
      focusedPath={selectedPath}
      searchTargetId={searchTargetId}
      nodeType="seriesNode"
      nodeComponent={SeriesTreeNode}
      layoutOptions={compactSeriesLayout}
      minZoom={0.35}
      nodesDraggable={false}
      onFocus={handleFocus}
      onRename={async (id) => onEdit(id)}
      onAddChild={async (id) => onAdd(id)}
      onDelete={async (id) => onDelete(id)}
    />
  );
}
