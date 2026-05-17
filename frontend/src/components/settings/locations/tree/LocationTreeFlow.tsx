// frontend/src/components/settings/locations/tree/LocationTreeFlow.tsx

import type { Location } from "../../../../types/location";

import { BaseTreeFlow } from "../../shared/BaseTreeFlow";

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
      onFocus={onFocus}
      onRename={onRename}
      onAddChild={onAddChild}
      onDelete={onDelete}
    />
  );
}
