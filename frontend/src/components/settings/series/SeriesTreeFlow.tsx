import { useCallback, useMemo } from "react";

import { BaseTreeFlow } from "../shared/BaseTreeFlow";
import { findPathIdsToNode } from "../shared/treeLayout";

import type { SeriesTreeNode as SeriesTreeNodeType } from "../../../types/series";

import { SeriesTreeNode } from "./SeriesTreeNode";
import { toSeriesFlowItems } from "./seriesTree";

type Props = {
  series: SeriesTreeNodeType[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
};

const noopRename = async () => undefined;
const noopAdd = async () => undefined;
const noopDelete = async () => undefined;

export function SeriesTreeFlow({ series, selectedId, onSelect }: Props) {
  const items = useMemo(() => toSeriesFlowItems(series), [series]);
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
      searchTargetId={null}
      nodeType="seriesNode"
      nodeComponent={SeriesTreeNode}
      minZoom={0.35}
      nodesDraggable={false}
      onFocus={handleFocus}
      onRename={noopRename}
      onAddChild={noopAdd}
      onDelete={noopDelete}
    />
  );
}
