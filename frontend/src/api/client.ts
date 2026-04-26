import axios from "axios";

// ✅ USE RELATIVE API (Caddy handles routing)
export const API = "/api";

// 🆕 AXIOS CLIENT
const client = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});

// 🔐 Attach token automatically + BLOCK if missing
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    // ✅ allow auth endpoints without token
    const isAuthRequest =
      config.url?.includes("/login") || config.url?.includes("/register");

    if (!token && !isAuthRequest) {
      // 🔥 HARD BLOCK → prevents 401 spam entirely
      return Promise.reject("NO_TOKEN");
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// 🔐 RESPONSE HANDLING
client.interceptors.response.use(
  (res) => res,
  (err) => {
    // ✅ silently ignore blocked requests
    if (err === "NO_TOKEN") {
      return Promise.reject(err);
    }

    if (err.response?.status === 401) {
      console.warn("Unauthorized request");

      // ❌ DO NOT auto-remove token
      // (prevents cascade failures)
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
