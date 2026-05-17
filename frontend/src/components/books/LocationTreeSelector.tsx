import type { Location } from "../../types/location";

import { buildTreeMap } from "../../utils/tree/buildTreeMap";
import { getTreePath } from "../../utils/tree/getTreePath";

import { TreeSelector } from "./tree/TreeSelector";
import { TreeSelectorField } from "./tree/TreeSelectorField";

type Props = {
  locations: Location[];

  selectedLocationId: number | null;

  onSelect: (id: number | null) => void;
};

export function LocationTreeSelector({
  locations,
  selectedLocationId,
  onSelect,
}: Props) {
  const map = buildTreeMap(locations);

  const value = getTreePath(selectedLocationId, map, "No location");

  return (
    <TreeSelectorField label="Location" value={value}>
      <TreeSelector
        nodes={locations}
        selectedId={selectedLocationId}
        onSelect={onSelect}
        emptyLabel="No location"
        clearLabel="No location"
      />
    </TreeSelectorField>
  );
}
