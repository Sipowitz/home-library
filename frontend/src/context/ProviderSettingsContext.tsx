import { createContext, useContext, useState } from "react";

import type { ProviderSetting, ProviderSettingUpdate } from "../types/provider";

import {
  fetchProviderSettings,
  updateProviderSetting,
} from "../api/providerSettings";

interface ProviderSettingsContextType {
  providers: ProviderSetting[];

  loading: boolean;

  refreshProviders: () => Promise<void>;

  updateProvider: (
    providerId: number,
    data: ProviderSettingUpdate,
  ) => Promise<void>;
}

const ProviderSettingsContext = createContext<
  ProviderSettingsContextType | undefined
>(undefined);

export function ProviderSettingsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [providers, setProviders] = useState<ProviderSetting[]>([]);

  const [loading, setLoading] = useState(false);

  const refreshProviders = async () => {
    setLoading(true);

    try {
      const data = await fetchProviderSettings();

      setProviders(data);
    } catch (err) {
      console.error("Failed to load provider settings", err);
    } finally {
      setLoading(false);
    }
  };

  const updateProvider = async (
    providerId: number,
    data: ProviderSettingUpdate,
  ) => {
    const updated = await updateProviderSetting(providerId, data);

    setProviders((prev) =>
      prev.map((provider) => (provider.id === providerId ? updated : provider)),
    );
  };

  return (
    <ProviderSettingsContext.Provider
      value={{
        providers,
        loading,
        refreshProviders,
        updateProvider,
      }}
    >
      {children}
    </ProviderSettingsContext.Provider>
  );
}

export function useProviderSettingsContext() {
  const context = useContext(ProviderSettingsContext);

  if (!context) {
    throw new Error(
      "useProviderSettingsContext must be used within ProviderSettingsProvider",
    );
  }

  return context;
}
