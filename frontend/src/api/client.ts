import axios from "axios";

export const API = "http://192.168.1.200:8000";

// 🆕 AXIOS CLIENT
const client = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔐 Attach token automatically (optional but useful)
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;

// 🔑 GOOGLE API KEY
export function getGoogleApiKey() {
  return localStorage.getItem("google_api_key") || "";
}

// 🔐 AUTH HEADER (keep for legacy usage)
export function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No token");
  return { Authorization: `Bearer ${token}` };
}

// 🔐 STORE TOKEN
export function setToken(token: string) {
  localStorage.setItem("token", token);
}
