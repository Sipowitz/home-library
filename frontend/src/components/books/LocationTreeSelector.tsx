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

  semanticTheme?: boolean;

  libraryFilter?: boolean;
};

export function LocationTreeSelector({
  locations,
  selectedLocationId,
  onSelect,
  floating = false,
  semanticTheme = false,
  libraryFilter = false,
}: Props) {
  const map = buildTreeMap(locations);

  const value = selectedLocationId === -1
    ? "No location"
    : getTreePath(selectedLocationId, map, "All locations");

  return (
    <TreeSelectorField label="Location" value={value} floating={floating} semanticTheme={semanticTheme}>
      <TreeSelector
        nodes={locations}
        selectedId={selectedLocationId}
        onSelect={onSelect}
        emptyLabel="All locations"
        clearLabel={libraryFilter ? "All locations" : "No location"}
        specialOptions={libraryFilter ? [{ id: -1, label: "No location" }] : []}
        semanticTheme={semanticTheme}
      />
    </TreeSelectorField>
  );
}
