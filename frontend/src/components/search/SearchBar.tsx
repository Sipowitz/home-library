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
    <div className="sticky top-0 z-30 pb-2">
      <div
        className="
          bg-gray-950/95
          backdrop-blur
          border border-gray-800
          p-4
          rounded-2xl
          shadow-lg
        "
      >
        <div className="flex flex-col gap-4">
          {/* SEARCH */}
          <input
            placeholder="Search title or author..."
            className="
              p-3
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* LOCATION */}
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-gray-500 mb-2 px-1">
                Location
              </div>

              <LocationTreeSelector
                locations={locations}
                selectedLocationId={selectedLocation}
                onSelect={onLocationChange}
              />
            </div>

            {/* CATEGORY */}
            <div>
              <div className="text-[11px] uppercase tracking-[0.12em] text-gray-500 mb-2 px-1">
                Category
              </div>

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
