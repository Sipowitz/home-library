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
    const data = await getLocations();
    setLocations(data);
  }

  useEffect(() => {
    load();
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
