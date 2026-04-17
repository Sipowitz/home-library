import { createContext, useContext, useEffect, useState } from "react";

export type Location = {
  id: number;
  name: string;
  parentId?: number;
};

type LocationContextType = {
  locations: Location[];
  addLocation: (name: string, parentId?: number) => void;
};

const LocationContext = createContext<LocationContextType | null>(null);

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("locations");
    if (stored) setLocations(JSON.parse(stored));
  }, []);

  function save(newLocations: Location[]) {
    setLocations(newLocations);
    localStorage.setItem("locations", JSON.stringify(newLocations));
  }

  function addLocation(name: string, parentId?: number) {
    const newLoc = {
      id: Date.now(),
      name,
      parentId,
    };
    save([...locations, newLoc]);
  }

  return (
    <LocationContext.Provider value={{ locations, addLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocations() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error("useLocations must be used inside LocationProvider");
  }
  return ctx;
}
