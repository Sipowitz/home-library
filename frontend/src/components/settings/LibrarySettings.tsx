import { LocationSettings } from "./locations/LocationSettings";

import { CategorySettings } from "./categories/CategorySettings";

import { ProviderSettingsPanel } from "./providers/ProviderSettingsPanel";

import type { Location } from "../../types/location";

type Props = {
  locations: Location[];
};

export function LibrarySettings({ locations }: Props) {
  return (
    <div className="space-y-8">
      {/* LOCATIONS */}

      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Locations</h2>

          <p className="text-sm text-text-muted mt-1">
            Organize where books are physically stored.
          </p>
        </div>

        <LocationSettings locations={locations} />
      </div>

      {/* CATEGORIES */}

      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Categories</h2>

          <p className="text-sm text-text-muted mt-1">
            Organize books by subject or collection.
          </p>
        </div>

        <CategorySettings />
      </div>

      {/* PROVIDERS */}

      <div className="bg-surface border border-border rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Providers</h2>

          <p className="text-sm text-text-muted mt-1">
            Manage metadata lookup providers and search priority.
          </p>
        </div>

        <ProviderSettingsPanel />
      </div>
    </div>
  );
}
