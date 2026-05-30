import axios from "axios";

import toast from "react-hot-toast";

export const API = "/api";

let handlingUnauthorized = false;

const client = axios.create({
  baseURL: API,
  headers: {
    "Content-Type": "application/json",
  },
});

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
      config.headers = config.headers || {};

      (config.headers as any)["Authorization"] = `Bearer ${token}`;
    }

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

    const isAuthValidationRequest = err.config?.url?.includes("/auth/me");

    if (isAuthValidationRequest) {
      return Promise.reject(err);
    }

    if (err.response?.status === 401) {
      if (!handlingUnauthorized) {
        handlingUnauthorized = true;

        console.warn("Session expired. Logging out.");

        toast.error("Your session has expired. Please log in again.");

        localStorage.removeItem("token");

        window.dispatchEvent(new Event("auth-expired"));

        setTimeout(() => {
          handlingUnauthorized = false;
        }, 1000);
      }

      return Promise.reject(err);
    }

    return Promise.reject(err);
  },
);

export default client;

// 🔑 helpers

export function getAuthHeaders() {
  const token = localStorage.getItem("token");

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function clearToken() {
  localStorage.removeItem("token");
}
