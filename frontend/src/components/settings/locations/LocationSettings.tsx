// frontend/src/components/settings/locations/LocationSettings.tsx

import type { Location } from "../../../types/location";

import { LocationTreePanel } from "./LocationTreePanel";

type Props = {
  locations: Location[];
};

export function LocationSettings({ locations }: Props) {
  return (
    <div
      className="
        relative
        flex-1
        min-h-0
        rounded-lg lg:rounded-2xl
        border border-gray-800/70 lg:border-gray-800
        bg-gray-900/20 lg:bg-gray-900/40
        overflow-hidden
      "
    >
      <LocationTreePanel locations={locations} />
    </div>
  );
}
