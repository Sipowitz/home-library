import { createContext, useContext, useEffect, useState } from "react";
import {
  getLocations,
  createLocation,
  deleteLocationApi,
} from "../api/locations";

export type Location = {
  id: number;
  name: string;
  parent_id?: number;
};

type LocationContextType = {
  locations: Location[];
  addLocation: (name: string, parentId?: number) => Promise<void>;
  deleteLocation: (id: number) => Promise<void>;
};

const LocationContext = createContext<LocationContextType | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);

  async function load() {
    try {
      const data = await getLocations();
      setLocations(data);
    } catch (err) {
      console.error("Failed to load locations", err);
      setLocations([]); // prevent stale state
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");

    // ✅ only load when logged in
    if (token) {
      load();
    }
  }, []);

  async function addLocation(name: string, parentId?: number) {
    await createLocation({ name, parent_id: parentId });
    await load(); // ✅ keeps context in sync
  }

  async function deleteLocation(id: number) {
    await deleteLocationApi(id);
    await load(); // ✅ keeps context in sync
  }

  return (
    <LocationContext.Provider
      value={{ locations, addLocation, deleteLocation }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useLocations() {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error("Must be inside provider");
  return ctx;
}
