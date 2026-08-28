import type { Location } from "../../types/location";

import { buildTreeMap } from "../../utils/tree/buildTreeMap";
import { getTreePath } from "../../utils/tree/getTreePath";

import { TreeSelector } from "./tree/TreeSelector";
import { TreeSelectorField } from "./tree/TreeSelectorField";

type Props = {
  locations: Location[];

  selectedLocationId: number | null;

  onSelect: (id: number | null) => void;

  floating?: boolean;
};

export function LocationTreeSelector({
  locations,
  selectedLocationId,
  onSelect,
  floating = false,
}: Props) {
  const map = buildTreeMap(locations);

  const value = getTreePath(selectedLocationId, map, "All locations");

  return (
    <TreeSelectorField label="Location" value={value} floating={floating}>
      <TreeSelector
        nodes={locations}
        selectedId={selectedLocationId}
        onSelect={onSelect}
        emptyLabel="All locations"
        clearLabel="No location"
      />
    </TreeSelectorField>
  );
}
