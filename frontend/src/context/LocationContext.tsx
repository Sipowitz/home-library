import { createContext, useContext, useEffect, useState } from "react";
import {
  getLocations,
  createLocation,
  deleteLocationApi,
} from "../api/locations";

import { useAuth } from "./AuthContext";

export type Location = {
  id: number;
  name: string;
  parent_id?: number;
};

type LocationContextType = {
  locations: Location[];
  addLocation: (name: string, parentId?: number) => Promise<void>;
  deleteLocation: (id: number) => Promise<void>;
  reloadLocations: () => Promise<void>; // ✅ NEW
};

const LocationContext = createContext<LocationContextType | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);

  const { token } = useAuth();

  // -------------------
  // 📥 LOAD LOCATIONS
  // -------------------
  async function load() {
    try {
      const data = await getLocations();
      setLocations(data);
    } catch (err) {
      console.error("Failed to load locations", err);
      setLocations([]);
    }
  }

  // -------------------
  // 🔥 AUTH-DRIVEN LOAD
  // -------------------
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setLocations([]);
        return;
      }

      try {
        const data = await getLocations();
        if (!cancelled) {
          setLocations(data);
        }
      } catch (err) {
        console.error("Failed to load locations", err);
        if (!cancelled) {
          setLocations([]);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // -------------------
  // ➕ ADD LOCATION
  // -------------------
  async function addLocation(name: string, parentId?: number) {
    await createLocation({ name, parent_id: parentId });

    // keep existing behaviour
    await load();
  }

  // -------------------
  // ❌ DELETE LOCATION
  // -------------------
  async function deleteLocation(id: number) {
    await deleteLocationApi(id);

    // keep existing behaviour
    await load();
  }

  return (
    <LocationContext.Provider
      value={{
        locations,
        addLocation,
        deleteLocation,
        reloadLocations: load, // ✅ exposed
      }}
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
