import axios from "axios";

export const API = "http://192.168.1.200:8000";

// 🆕 AXIOS CLIENT
const client = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔐 Attach token automatically
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ✅ FIXED — no infinite reload loop
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      console.warn("Unauthorized");

      // remove bad token
      localStorage.removeItem("token");

      // ❌ REMOVE reload loop
      // window.location.reload();
    }

    return Promise.reject(err);
  },
);

export default client;

// 🔑 GOOGLE API KEY
export function getGoogleApiKey() {
  return localStorage.getItem("google_api_key") || "";
}

// 🔐 AUTH HEADER (SAFE)
export function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

// 🔐 STORE TOKEN
export function setToken(token: string) {
  localStorage.setItem("token", token);
}
