import { ChangeEvent } from "react";

type Location = {
  id: number;
  name: string;
};

type Props = {
  searchInput: string;
  onSearchChange: (value: string) => void;
  selectedLocation: number | null;
  onLocationChange: (value: number | null) => void;
  locations: Location[];
};

export function SearchBar({
  searchInput,
  onSearchChange,
  selectedLocation,
  onLocationChange,
  locations,
}: Props) {
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
        value={selectedLocation ?? ""}
        onChange={(e) =>
          onLocationChange(e.target.value ? Number(e.target.value) : null)
        }
      >
        <option value="">All Locations</option>

        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </div>
  );
}
