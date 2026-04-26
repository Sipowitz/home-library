import { useState } from "react";

type Location = {
  id: number;
  name: string;
  parent_id?: number;
  children?: Location[];
};

type Props = {
  locations: Location[];
  locationTree: Location[];
  newLocation: string;
  setNewLocation: (v: string) => void;
  parentId: number | "";
  setParentId: (v: number | "") => void;
  onAddLocation: () => void;
  onDeleteRequest: (id: number) => void;
};

// ================= LOCATION NODE =================
function LocationNode({
  node,
  onDelete,
}: {
  node: Location;
  onDelete: (id: number) => void;
}) {
  const [open, setOpen] = useState(true);

  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="ml-2">
      <div className="flex items-center justify-between bg-gray-800 px-2 py-1 rounded">
        <div className="flex items-center gap-2">
          {hasChildren && (
            <button
              onClick={() => setOpen(!open)}
              className="text-xs text-gray-400"
            >
              {open ? "▼" : "▶"}
            </button>
          )}
          <span className="text-gray-300">{node.name}</span>
        </div>

        <button
          onClick={() => onDelete(node.id)}
          className="text-red-400 text-xs"
        >
          Delete
        </button>
      </div>

      {open && hasChildren && (
        <div className="ml-4 mt-1 space-y-1 border-l border-gray-700 pl-2">
          {node.children!.map((child) => (
            <LocationNode key={child.id} node={child} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function LocationSettings({
  locations,
  locationTree,
  newLocation,
  setNewLocation,
  parentId,
  setParentId,
  onAddLocation,
  onDeleteRequest,
}: Props) {
  // 🔍 DEBUG (keep for now)
  console.log("LOCATIONS IN UI:", locations);

  return (
    <>
      <h3 className="text-lg mb-2">Locations</h3>

      <input
        placeholder="New location name"
        className="w-full p-2 bg-gray-800 rounded mb-2"
        value={newLocation}
        onChange={(e) => setNewLocation(e.target.value)}
      />

      <select
        className="w-full p-2 bg-gray-800 rounded mb-2"
        value={parentId}
        onChange={(e) =>
          setParentId(e.target.value ? Number(e.target.value) : "")
        }
      >
        <option value="">No parent</option>

        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>

      <button
        onClick={onAddLocation}
        className="bg-blue-600 w-full py-2 rounded mb-4"
      >
        Add Location
      </button>

      <div className="max-h-40 overflow-y-auto text-sm space-y-1">
        {locationTree.map((loc) => (
          <LocationNode key={loc.id} node={loc} onDelete={onDeleteRequest} />
        ))}
      </div>
    </>
  );
}
