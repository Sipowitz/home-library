import { createContext, useContext, useEffect, useState, useRef } from "react";

import client from "../api/client";

type AuthContextType = {
  token: string | null;

  ready: boolean;

  isAuthenticated: boolean;

  user: AuthUser | null;

  login: (token: string) => void;

  logout: () => void;
};

type AuthUser = {
  id: number; username: string; email: string; is_active: boolean; is_admin: boolean;
};

type Props = {
  children: React.ReactNode;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: Props) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

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
        const response = await client.get<AuthUser>("/auth/me");

        setTokenState(stored);
        setUser(response.data);
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
      setUser(null);
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
    client.get<AuthUser>("/auth/me").then((response) => setUser(response.data));
  }

  // -------------------
  // 🚪 LOGOUT
  // -------------------
  function logout(): void {
    localStorage.removeItem("token");

    setTokenState(null);
    setUser(null);
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
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error("useAuth must be inside AuthProvider");
  }

  return ctx;
}
