import client from "./client";

import type { Location } from "../types/location";

type LocationCreateInput = {
  name: string;
  parent_id?: number;
};

// -------------------
// 📍 GET LOCATIONS
// -------------------
export async function getLocations(): Promise<Location[]> {
  const res = await client.get("/locations/");

  return res.data;
}

// -------------------
// ➕ CREATE LOCATION
// -------------------
export async function createLocation(
  data: LocationCreateInput,
): Promise<Location> {
  const res = await client.post("/locations/", data);

  return res.data;
}

// -------------------
// 🗑 DELETE LOCATION
// -------------------
export async function deleteLocationApi(id: number): Promise<void> {
  await client.delete(`/locations/${id}`);
}
