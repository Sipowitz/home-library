import { API, getAuthHeaders } from "./client";

export async function getLocations() {
  const res = await fetch(`${API}/locations/`, {
    headers: getAuthHeaders(),
  });
  return res.json();
}

export async function createLocation(data: any) {
  const res = await fetch(`${API}/locations/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteLocationApi(id: number) {
  await fetch(`${API}/locations/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
}
