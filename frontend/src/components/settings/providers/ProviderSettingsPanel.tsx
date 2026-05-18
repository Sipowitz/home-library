import { useEffect } from "react";

import { useProviderSettings } from "../../../hooks/useProviderSettings";

export function ProviderSettingsPanel() {
  const { providers, loading, refreshProviders, updateProvider } =
    useProviderSettings();

  useEffect(() => {
    refreshProviders();
  }, []);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading providers...</div>;
  }

  return (
    <div className="space-y-4">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="
            bg-gray-900/60
            border border-gray-800
            rounded-xl
            p-4
            space-y-4
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white">
                {provider.provider_name}
              </h3>

              <p className="text-sm text-gray-400 mt-1">
                Configure provider availability and priority.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-gray-300">Enabled</span>

              <input
                type="checkbox"
                checked={provider.enabled}
                onChange={(e) =>
                  updateProvider(provider.id, {
                    enabled: e.target.checked,
                  })
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Priority
              </label>

              <input
                type="number"
                value={provider.priority}
                onChange={(e) =>
                  updateProvider(provider.id, {
                    priority: Number(e.target.value),
                  })
                }
                className="
                  w-full
                  rounded-lg
                  bg-gray-950
                  border border-gray-700
                  px-3 py-2
                  text-white
                "
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Timeout
              </label>

              <input
                type="number"
                value={provider.timeout_seconds}
                onChange={(e) =>
                  updateProvider(provider.id, {
                    timeout_seconds: Number(e.target.value),
                  })
                }
                className="
                  w-full
                  rounded-lg
                  bg-gray-950
                  border border-gray-700
                  px-3 py-2
                  text-white
                "
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Retries
              </label>

              <input
                type="number"
                value={provider.max_retries}
                onChange={(e) =>
                  updateProvider(provider.id, {
                    max_retries: Number(e.target.value),
                  })
                }
                className="
                  w-full
                  rounded-lg
                  bg-gray-950
                  border border-gray-700
                  px-3 py-2
                  text-white
                "
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
