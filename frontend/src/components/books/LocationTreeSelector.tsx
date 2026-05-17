import type { Location } from "../../types/location";

import { TreeSelector } from "./tree/TreeSelector";

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
  return (
    <TreeSelector
      nodes={locations}
      selectedId={selectedLocationId}
      onSelect={onSelect}
      emptyLabel="No location"
      clearLabel="No location"
      selectable={(node) => !node.children?.length}
    />
  );
}
