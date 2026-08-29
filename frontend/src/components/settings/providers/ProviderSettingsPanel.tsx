import { useEffect, useState } from "react";

import { Eye, EyeOff } from "lucide-react";

import { useProviderSettings } from "../../../hooks/useProviderSettings";
import { ActionButton } from "../../ui/ActionButton";

export function ProviderSettingsPanel() {
  const { providers, loading, refreshProviders, updateProvider } =
    useProviderSettings();

  const [apiKeyValues, setApiKeyValues] = useState<Record<number, string>>({});

  const [showApiKeys, setShowApiKeys] = useState<Record<number, boolean>>({});

  useEffect(() => {
    refreshProviders();
    // The context action is intentionally invoked once when this panel opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="text-sm text-text-muted">Loading providers...</div>;
  }

  return (
    <div className="space-y-4">
      {providers.map((provider) => (
        <div
          key={provider.id}
          className="
            bg-surface
            border border-border
            rounded-xl
            p-4
            space-y-4
          "
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-text-primary">
                {provider.provider_name}
              </h3>

              <p className="text-sm text-text-muted mt-1">
                Configure provider availability and priority.
              </p>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <span className="text-text-secondary">Enabled</span>

              <input
                type="checkbox"
                className="accent-blue-600"
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
              <label className="block text-sm text-text-muted mb-1">
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
                  form-control rounded-lg
                  px-3 py-2
                "
              />
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">
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
                  form-control rounded-lg
                  px-3 py-2
                "
              />
            </div>

            <div>
              <label className="block text-sm text-text-muted mb-1">
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
                  form-control rounded-lg
                  px-3 py-2
                "
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">API Key</label>

            <div className="relative">
              <input
                type={showApiKeys[provider.id] ? "text" : "password"}
                value={apiKeyValues[provider.id] ?? ""}
                onChange={(e) =>
                  setApiKeyValues((prev) => ({
                    ...prev,
                    [provider.id]: e.target.value,
                  }))
                }
                placeholder={provider.has_api_key ? "Key configured — enter replacement" : "Enter API key"}
                className="
                  w-full
                  form-control rounded-lg
                  px-3 py-2
                  pr-10
                "
              />

              <ActionButton
                type="button"
                variant="icon"
                size="iconSm"
                onClick={() =>
                  setShowApiKeys((prev) => ({
                    ...prev,
                    [provider.id]: !prev[provider.id],
                  }))
                }
                className="
                  absolute
                  right-1
                  top-1/2
                  -translate-y-1/2
                "
              >
                {showApiKeys[provider.id] ? (
                  <EyeOff size={18} />
                ) : (
                  <Eye size={18} />
                )}
              </ActionButton>
            </div>
            <div className="flex gap-2 mt-2">
              <ActionButton variant="secondary" size="sm" onClick={async () => {
                const value = apiKeyValues[provider.id]?.trim();
                if (!value) return;
                await updateProvider(provider.id, { api_key: value });
                setApiKeyValues((prev) => ({ ...prev, [provider.id]: "" }));
              }}>Save key</ActionButton>
              {provider.has_api_key && <ActionButton variant="danger" size="sm" onClick={() => updateProvider(provider.id, { clear_api_key: true })}>Remove key</ActionButton>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
