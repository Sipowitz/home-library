import { useMemo, type ChangeEvent } from "react";

import type { Location } from "../../types/location";
import type { Category } from "../../types/category";

type FlatLocation = {
  id: number;
  name: string;
};

type FlatCategory = {
  id: number;
  name: string;
};

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

function flattenLocations(nodes: Location[], depth = 0): FlatLocation[] {
  let result: FlatLocation[] = [];

  for (const node of nodes) {
    result.push({
      id: node.id,
      name: `${"— ".repeat(depth)}${node.name}`,
    });

    if (node.children?.length) {
      result = result.concat(flattenLocations(node.children, depth + 1));
    }
  }

  return result;
}

function flattenCategories(nodes: Category[], depth = 0): FlatCategory[] {
  let result: FlatCategory[] = [];

  for (const node of nodes) {
    result.push({
      id: node.id,
      name: `${"— ".repeat(depth)}${node.name}`,
    });

    if (node.children?.length) {
      result = result.concat(flattenCategories(node.children, depth + 1));
    }
  }

  return result;
}

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
  const flatLocations = useMemo(() => flattenLocations(locations), [locations]);

  const flatCategories = useMemo(
    () => flattenCategories(categories),
    [categories],
  );

  // -------------------
  // 🔁 HANDLERS
  // -------------------

  function handleLocationChange(val: string) {
    if (val === "") return onLocationChange(null);

    if (val === "-1") return onLocationChange(-1);

    onLocationChange(Number(val));
  }

  function handleCategoryChange(val: string) {
    if (val === "") return onCategoryChange(null);

    if (val === "-1") return onCategoryChange(-1);

    onCategoryChange(Number(val));
  }

  return (
    <div className="sticky top-0 z-30 pb-2">
      <div className="bg-gray-950/95 backdrop-blur border border-gray-800 p-4 rounded-2xl shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* SEARCH */}
          <input
            placeholder="Search title or author..."
            className="p-3 bg-gray-800 rounded-lg w-full outline-none focus:ring-2 focus:ring-blue-500"
            value={searchInput}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              onSearchChange(e.target.value)
            }
          />

          {/* LOCATION */}
          <select
            className="p-3 bg-gray-800 rounded-lg w-full sm:w-auto"
            value={selectedLocation === null ? "" : String(selectedLocation)}
            onChange={(e) => handleLocationChange(e.target.value)}
          >
            <option value="">All Locations</option>

            <option value="-1">No Location</option>

            {flatLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>

          {/* CATEGORY */}
          <select
            className="p-3 bg-gray-800 rounded-lg w-full sm:w-auto"
            value={selectedCategory === null ? "" : String(selectedCategory)}
            onChange={(e) => handleCategoryChange(e.target.value)}
          >
            <option value="">All Categories</option>

            <option value="-1">No Category</option>

            {flatCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
