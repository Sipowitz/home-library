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
  const flatLocations = useMemo(() => {
    return flattenLocations(locations);
  }, [locations]);

  return (
    <div className="sticky top-0 z-30 pb-2">
      {/* INNER BAR */}
      <div className="bg-gray-950/95 backdrop-blur border border-gray-800 p-4 rounded-2xl flex gap-3 items-center shadow-lg">
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
              onLocationChange(null);
            } else if (val === "none") {
              onLocationChange(-1);
            } else {
              onLocationChange(Number(val));
            }
          }}
        >
          <option value="">All Locations</option>
          <option value="none">No Location</option>

          {flatLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
