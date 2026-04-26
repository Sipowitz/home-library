import client from "./client";

// 📍 GET LOCATIONS
export async function getLocations() {
  const res = await client.get("/locations");
  return res.data;
}

// ➕ CREATE LOCATION
export async function createLocation(data: any) {
  const res = await client.post("/locations", data);
  return res.data;
}

// 🗑 DELETE LOCATION
export async function deleteLocationApi(id: number) {
  await client.delete(`/locations/${id}`);
}
