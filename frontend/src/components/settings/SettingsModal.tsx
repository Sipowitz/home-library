import { useState } from "react";
import { useLocations } from "../../context/LocationContext";

type Props = {
  isOpen: boolean;
  apiKey: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
};

export function SettingsModal({
  isOpen,
  apiKey,
  onChange,
  onSave,
  onClose,
}: Props) {
  const { locations, addLocation } = useLocations();

  const [newLocation, setNewLocation] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 p-6 rounded-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-xl mb-4">Settings</h2>

        {/* API KEY */}
        <input
          className="w-full p-2 bg-gray-800 rounded mb-4"
          value={apiKey}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Google API key"
        />

        {/* SAVE API KEY */}
        <button
          onClick={onSave}
          className="bg-green-600 w-full py-2 rounded mb-6"
        >
          Save API Key
        </button>

        {/* LOCATIONS */}
        <h3 className="text-lg mb-2">Locations</h3>

        {/* ADD LOCATION */}
        <input
          placeholder="New location name"
          className="w-full p-2 bg-gray-800 rounded mb-2"
          value={newLocation}
          onChange={(e) => setNewLocation(e.target.value)}
        />

        {/* PARENT SELECT */}
        <select
          className="w-full p-2 bg-gray-800 rounded mb-2"
          value={parentId}
          onChange={(e) =>
            setParentId(e.target.value ? Number(e.target.value) : "")
          }
        >
          <option value="">No parent (top level)</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            if (!newLocation.trim()) return;
            addLocation(newLocation, parentId || undefined);
            setNewLocation("");
            setParentId("");
          }}
          className="bg-blue-600 w-full py-2 rounded mb-4"
        >
          Add Location
        </button>

        {/* LOCATION LIST */}
        <div className="max-h-40 overflow-y-auto text-sm space-y-1">
          {locations.map((loc) => {
            const parent = locations.find((l) => l.id === loc.parentId);
            return (
              <div key={loc.id} className="text-gray-300">
                {parent ? `${parent.name} > ${loc.name}` : loc.name}
              </div>
            );
          })}
        </div>

        {/* CLOSE */}
        <button
          onClick={onClose}
          className="bg-gray-600 w-full py-2 rounded mt-4"
        >
          Close
        </button>
      </div>
    </div>
  );
}
