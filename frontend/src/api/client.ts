import axios from "axios";

export const API = "/api";

const client = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ DEBUG
console.log("AXIOS BASE URL =", client.defaults.baseURL);

// 🔐 Attach token correctly
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    const isAuthRequest =
      config.url?.includes("/login") || config.url?.includes("/register");

    if (!token && !isAuthRequest) {
      return Promise.reject("NO_TOKEN");
    }

    if (token) {
      // ✅ SAFE way (works with Axios v1+)
      config.headers = config.headers || {};
      (config.headers as any)["Authorization"] = `Bearer ${token}`;
    }

    // ✅ DEBUG
    console.log("AXIOS REQUEST", {
      baseURL: config.baseURL,
      url: config.url,
      fullURL: `${config.baseURL}${config.url}`,
      headers: config.headers,
    });

    return config;
  },
  (error) => Promise.reject(error),
);

// 🔐 Response handling
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err === "NO_TOKEN") {
      return Promise.reject(err);
    }

    if (err.response?.status === 401) {
      console.warn("Unauthorized request");
    }

    return Promise.reject(err);
  },
);

export default client;

// 🔑 helpers
export function getGoogleApiKey() {
  return localStorage.getItem("google_api_key") || "";
}

export function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}
