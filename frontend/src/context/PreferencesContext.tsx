import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchPreferences,
  updatePreferences as updatePreferencesApi,
} from "../api/preferences";

import { useAuth } from "./AuthContext";

import type { Preferences, PreferencesUpdate } from "../types/preferences";

type PreferencesContextValue = {
  preferences: Preferences | null;

  loading: boolean;

  refreshPreferences: () => Promise<void>;

  updatePreferences: (data: PreferencesUpdate) => Promise<void>;
};

const PreferencesContext = createContext<PreferencesContextValue | undefined>(
  undefined,
);

type Props = {
  children: React.ReactNode;
};

export function PreferencesProvider({ children }: Props) {
  const { isAuthenticated } = useAuth();

  const [preferences, setPreferences] = useState<Preferences | null>(null);

  const [loading, setLoading] = useState(true);

  // -------------------
  // 📥 LOAD
  // -------------------

  const refreshPreferences = useCallback(async () => {
    if (!isAuthenticated) {
      setPreferences(null);
      setLoading(false);

      return;
    }

    try {
      setLoading(true);

      const data = await fetchPreferences();

      setPreferences(data);
    } catch (err) {
      console.error("Failed to load preferences", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  // -------------------
  // ✏️ UPDATE
  // -------------------

  async function updatePreferences(data: PreferencesUpdate) {
    if (!preferences) return;

    const previous = preferences;

    // optimistic update
    setPreferences({
      ...preferences,
      ...data,
    });

    try {
      const updated = await updatePreferencesApi(data);

      setPreferences(updated);
    } catch (err) {
      console.error("Failed to update preferences", err);

      // rollback
      setPreferences(previous);

      throw err;
    }
  }

  // -------------------
  // 🚀 INIT
  // -------------------

  useEffect(() => {
    refreshPreferences();
  }, [refreshPreferences]);

  // -------------------
  // 📦 VALUE
  // -------------------

  const value = useMemo(
    () => ({
      preferences,
      loading,
      refreshPreferences,
      updatePreferences,
    }),
    [preferences, loading, refreshPreferences],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

// -------------------
// 🪝 HOOK
// -------------------

export function usePreferencesContext() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error(
      "usePreferencesContext must be used inside PreferencesProvider",
    );
  }

  return context;
}
