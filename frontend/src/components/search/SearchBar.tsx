import { type ChangeEvent } from "react";

import type { Location } from "../../types/location";
import type { Category } from "../../types/category";

import { LocationTreeSelector } from "../books/LocationTreeSelector";
import { CategoryTreeSelector } from "../books/CategoryTreeSelector";

type Props = {
  searchInput: string;
  onSearchChange: (value: string) => void;

  selectedLocation: number | null;
  onLocationChange: (value: number | null) => void;

  selectedCategory: number | null;
  onCategoryChange: (value: number | null) => void;

  locations: Location[];
  categories: Category[];
};

export function SearchBar({
  searchInput,
  onSearchChange,
  selectedLocation,
  onLocationChange,
  selectedCategory,
  onCategoryChange,
  locations,
  categories,
}: Props) {
  return (
    <div>
      <div
        className="
          bg-gray-950/95
          backdrop-blur
          border border-gray-800
          p-2 sm:p-2.5
          rounded-2xl
          shadow-lg
        "
      >
        <div className="flex flex-col gap-2">
          {/* SEARCH */}
          <input
            placeholder="Search title or author..."
            className="
              px-3 py-2.5
              bg-gray-800
              rounded-xl
              w-full
              outline-none
              border border-gray-700
              focus:border-blue-500
              focus:ring-2 focus:ring-blue-500/20
              transition
            "
            value={searchInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onSearchChange(e.target.value)
            }
          />

          {/* FILTERS */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {/* LOCATION */}
            <div>
              <LocationTreeSelector
                locations={locations}
                selectedLocationId={selectedLocation}
                onSelect={onLocationChange}
              />
            </div>

            {/* CATEGORY */}
            <div>
              <CategoryTreeSelector
                categories={categories}
                selectedCategoryId={selectedCategory}
                onSelect={onCategoryChange}
                showSpecialOptions
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
