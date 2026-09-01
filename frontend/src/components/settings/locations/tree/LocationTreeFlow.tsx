// frontend/src/components/settings/locations/tree/LocationTreeFlow.tsx

import type { Location } from "../../../../types/location";

import { BaseTreeFlow } from "../../shared/BaseTreeFlow";
import type { TreeLayoutOptions } from "../../shared/treeLayout";

import { LocationTreeNode } from "./LocationTreeNode";

type Props = {
  locations: Location[];

  focusedId: number | null;

  focusedPath: number[];

  searchTargetId: string | null;

  onFocus: (id: number) => void;

  onRename: (id: number, name: string) => Promise<void>;

  onAddChild: (parentId: number, name: string) => Promise<void>;

  onDelete: (id: number) => Promise<void>;
};

const compactLocationLayout = {
  nodeWidth: 150,
  nodeHeight: 40,
  nodesep: 24,
  ranksep: 64,
  rankdir: "LR",
} satisfies TreeLayoutOptions;

export function LocationTreeFlow({
  locations,

  focusedId,

  focusedPath,

  searchTargetId,

  onFocus,

  onRename,

  onAddChild,

  onDelete,
}: Props) {
  return (
    <BaseTreeFlow
      items={locations}
      focusedId={focusedId}
      focusedPath={focusedPath}
      searchTargetId={searchTargetId}
      nodeType="locationNode"
      nodeComponent={LocationTreeNode}
      layoutOptions={compactLocationLayout}
      minZoom={0.35}
      onFocus={onFocus}
      onRename={onRename}
      onAddChild={onAddChild}
      onDelete={onDelete}
    />
  );
}
