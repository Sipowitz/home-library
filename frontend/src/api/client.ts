export const API = "http://192.168.1.200:8000";

// 🔑 GOOGLE API KEY
export function getGoogleApiKey() {
  return localStorage.getItem("google_api_key") || "";
}

// 🔐 AUTH HEADER
export function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No token");
  return { Authorization: `Bearer ${token}` };
}

// 🔐 STORE TOKEN (used by auth.ts)
export function setToken(token: string) {
  localStorage.setItem("token", token);
}
