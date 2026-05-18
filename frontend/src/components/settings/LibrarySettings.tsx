import { LocationSettings } from "./locations/LocationSettings";

import { CategorySettings } from "./categories/CategorySettings";

import { ProviderSettingsPanel } from "./providers/ProviderSettingsPanel";

import type { Category } from "../../types/category";

import type { Location } from "../../types/location";

type Props = {
  locations: Location[];

  categories: Category[];
};

export function LibrarySettings({ locations, categories }: Props) {
  return (
    <div className="space-y-8">
      {/* LOCATIONS */}

      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Locations</h2>

          <p className="text-sm text-gray-400 mt-1">
            Organize where books are physically stored.
          </p>
        </div>

        <LocationSettings locations={locations} />
      </div>

      {/* CATEGORIES */}

      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Categories</h2>

          <p className="text-sm text-gray-400 mt-1">
            Organize books by subject or collection.
          </p>
        </div>

        <CategorySettings categories={categories} />
      </div>

      {/* PROVIDERS */}

      <div className="bg-gray-900/60 border border-gray-800 rounded-xl p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Providers</h2>

          <p className="text-sm text-gray-400 mt-1">
            Manage metadata lookup providers and search priority.
          </p>
        </div>

        <ProviderSettingsPanel />
      </div>
    </div>
  );
}
