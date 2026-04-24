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
      setLocations([]);
    }
  }

  // -------------------
  // ✅ INITIAL LOAD
  // -------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) load();
  }, []);

  // -------------------
  // 🔥 FIX — RELOAD ON LOGIN / LOGOUT
  // -------------------
  useEffect(() => {
    function handleAuthChange() {
      const token = localStorage.getItem("token");

      if (token) {
        load(); // login → fetch locations
      } else {
        setLocations([]); // logout → clear
      }
    }

    window.addEventListener("auth-changed", handleAuthChange);

    return () => {
      window.removeEventListener("auth-changed", handleAuthChange);
    };
  }, []);

  async function addLocation(name: string, parentId?: number) {
    await createLocation({ name, parent_id: parentId });
    await load();
  }

  async function deleteLocation(id: number) {
    await deleteLocationApi(id);
    await load();
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
