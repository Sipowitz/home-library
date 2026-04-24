import { createContext, useContext, useEffect, useState } from "react";

type AuthContextType = {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // 🔥 INIT FROM STORAGE
  useEffect(() => {
    const stored = localStorage.getItem("token");
    setTokenState(stored);
    setReady(true);
  }, []);

  function login(token: string) {
    localStorage.setItem("token", token);
    setTokenState(token);
  }

  function logout() {
    localStorage.removeItem("token");
    setTokenState(null);
  }

  if (!ready) return null;

  return (
    <AuthContext.Provider
      value={{
        token,
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
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
