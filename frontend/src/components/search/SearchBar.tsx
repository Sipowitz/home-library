import { useMemo, ChangeEvent } from "react";

type Location = {
  id: number;
  name: string;
  parent_id?: number;
  children?: Location[];
};

type Props = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  selectedLocation: number | null;
  onLocationChange: (value: number | null) => void;
  locations: Location[];
};

// -------------------
// 🔽 FLATTEN TREE
// -------------------
function flattenLocations(
  nodes: Location[],
  depth = 0,
): { id: number; name: string }[] {
  let result: { id: number; name: string }[] = [];

  for (const node of nodes) {
    result.push({
      id: node.id,
      name: `${"— ".repeat(depth)}${node.name}`,
    });

    if (node.children && node.children.length > 0) {
      result = result.concat(flattenLocations(node.children, depth + 1));
    }
  }

  return result;
}

export function SearchBar({
  searchInput,
  onSearchChange,
  selectedLocation,
  onLocationChange,
  locations,
}: Props) {
  // -------------------
  // 📦 FLATTENED LOCATIONS
  // -------------------
  const flatLocations = useMemo(() => {
    return flattenLocations(locations);
  }, [locations]);

  return (
    <div className="bg-gray-900/60 border border-gray-800 backdrop-blur p-4 rounded-2xl mb-6 flex gap-3 items-center">
      <input
        placeholder="Search title or author..."
        className="p-3 bg-gray-800 rounded-lg w-full outline-none focus:ring-2 focus:ring-blue-500"
        value={searchInput}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          onSearchChange(e.target.value)
        }
      />

      <select
        className="p-3 bg-gray-800 rounded-lg"
        value={selectedLocation === null ? "" : selectedLocation}
        onChange={(e) => {
          const val = e.target.value;

          if (val === "") {
            onLocationChange(null); // All Locations
          } else if (val === "none") {
            onLocationChange(-1); // No Location sentinel
          } else {
            onLocationChange(Number(val));
          }
        }}
      >
        {/* ALL */}
        <option value="">All Locations</option>

        {/* NO LOCATION */}
        <option value="none">No Location</option>

        {/* FLATTENED TREE */}
        {flatLocations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
}
