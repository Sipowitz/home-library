import { createContext, useContext, useEffect, useState, useRef } from "react";

import client from "../api/client";

type AuthContextType = {
  token: string | null;

  ready: boolean;

  isAuthenticated: boolean;

  login: (token: string) => void;

  logout: () => void;
};

type Props = {
  children: React.ReactNode;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: Props) {
  const [token, setTokenState] = useState<string | null>(null);

  const [ready, setReady] = useState(false);

  const initializedRef = useRef(false);

  // -------------------
  // 🔥 INIT FROM STORAGE
  // -------------------
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    async function initialize() {
      const stored = localStorage.getItem("token");

      if (!stored) {
        setReady(true);

        return;
      }

      try {
        await client.get("/auth/me");

        setTokenState(stored);
      } catch {
        console.warn("Stored token invalid. Logging out.");

        localStorage.removeItem("token");

        setTokenState(null);
      }

      setReady(true);
    }

    initialize();
  }, []);

  // -------------------
  // 🔐 SESSION EXPIRED
  // -------------------
  useEffect(() => {
    function handleAuthExpired() {
      setTokenState(null);
    }

    window.addEventListener("auth-expired", handleAuthExpired);

    return () => {
      window.removeEventListener("auth-expired", handleAuthExpired);
    };
  }, []);

  // -------------------
  // 🔐 LOGIN
  // -------------------
  function login(token: string): void {
    localStorage.setItem("token", token);

    setTokenState(token);
  }

  // -------------------
  // 🚪 LOGOUT
  // -------------------
  function logout(): void {
    localStorage.removeItem("token");

    setTokenState(null);
  }

  if (!ready) {
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        ready,
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be inside AuthProvider");
  }

  return ctx;
}
