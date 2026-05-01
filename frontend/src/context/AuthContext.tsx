import { createContext, useContext, useEffect, useState } from "react";

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

  // -------------------
  // 🔥 INIT FROM STORAGE
  // -------------------
  useEffect(() => {
    const stored = localStorage.getItem("token");

    setTokenState(stored);

    setReady(true);
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
