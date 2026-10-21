import { useEffect, useState } from "react";

import { Eye, EyeOff, LoaderCircle } from "lucide-react";

import { useProviderSettings } from "../../../hooks/useProviderSettings";
import { ActionButton } from "../../ui/ActionButton";
import { testProviderConnection } from "../../../api/providerSettings";
import type { ProviderConnectionTest } from "../../../types/provider";

function failureSummary(result: ProviderConnectionTest): string {
  if (result.http_status === 429 || result.error_category === "rate_limited") {
    return "The daily API quota has been exceeded.";
  }
  if (result.error_category === "missing_credentials") return "An API key is required to test this provider.";
  if (result.error_category === "authentication") return "The provider rejected the configured API key.";
  if (result.error_category === "timeout") return "The provider did not respond before the connection test timed out.";
  if (result.error_category === "transport") return "The provider could not be reached.";
  if (result.error_category === "server_error") return "The provider is currently unavailable.";
  if (result.error_category === "invalid_response") return "The provider returned an invalid response.";
  if (result.error_category === "no_metadata") return "The provider returned no metadata for the test book.";
  return "The connection test could not be completed.";
}

function safeTechnicalDetails(message: string | null): string | null {
  if (!message) return null;
  return message
    .replace(/authorization\s*[:=]\s*(?:bearer\s+)?[^\s&,:]+/gi, "Authorization=[redacted]")
    .replace(/(api[_-]?key|key|token)\s*[:=]\s*[^\s&,:]+/gi, "$1=[redacted]");
}

export function ProviderSettingsPanel() {
  const { providers, loading, refreshProviders, updateProvider } =
    useProviderSettings();

  const [apiKeyValues, setApiKeyValues] = useState<Record<number, string>>({});

  const [showApiKeys, setShowApiKeys] = useState<Record<number, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, ProviderConnectionTest>>({});

  const runConnectionTest = async (providerName: string) => {
    setTesting((previous) => ({ ...previous, [providerName]: true }));
    try {
      const result = await testProviderConnection(providerName);
      setTestResults((previous) => ({ ...previous, [providerName]: result }));
    } catch (error: any) {
      const response = error?.response?.data;
      setTestResults((previous) => ({
        ...previous,
        [providerName]: {
          success: false,
          provider_id: providerName,
          duration_ms: 0,
          http_status: response?.http_status ?? null,
          error_category: response?.error_category ?? null,
          message: response?.message ?? response?.detail ?? "Connection test could not be completed.",
        },
      }));
    } finally {
      setTesting((previous) => ({ ...previous, [providerName]: false }));
    }
  };

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
              {provider.has_api_key && <ActionButton variant="danger" size="sm" onClick={async () => {
                await updateProvider(provider.id, { clear_api_key: true });
                setApiKeyValues((prev) => ({ ...prev, [provider.id]: "" }));
              }}>Remove key</ActionButton>}
            </div>
            {provider.provider_name === "isbndb" && <p className="mt-2 text-sm text-text-muted">
              {provider.has_api_key ? "API key configured" : "No stored API key configured"}
            </p>}
          </div>

          <div className="border-t border-border pt-4">
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={() => runConnectionTest(provider.provider_name)}
              disabled={testing[provider.provider_name] === true}
              aria-describedby={`provider-test-status-${provider.id}`}
            >
              {testing[provider.provider_name] ? <><LoaderCircle className="animate-spin" size={16} aria-hidden="true" /> Testing…</> : "Test Connection"}
            </ActionButton>
            <div id={`provider-test-status-${provider.id}`} className="mt-2 text-sm" role="status" aria-live="polite">
              {testing[provider.provider_name] && <span className="text-text-muted">Testing {provider.provider_name}…</span>}
              {!testing[provider.provider_name] && testResults[provider.provider_name] && (() => {
                const result = testResults[provider.provider_name];
                const details = [`${result.duration_ms} ms`, result.http_status ? `HTTP ${result.http_status}` : null].filter(Boolean).join(" · ");
                const technicalDetails = safeTechnicalDetails(result.message);
                return result.success
                  ? <span className="text-success">Connection successful{details ? ` · ${details}` : ""}</span>
                  : <div className="text-danger"><span>{failureSummary(result)}{details ? ` ${details}` : ""}</span>{technicalDetails && <details className="mt-1 text-text-muted"><summary className="cursor-pointer">Technical details</summary><p className="mt-1">{technicalDetails}</p></details>}</div>;
              })()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
