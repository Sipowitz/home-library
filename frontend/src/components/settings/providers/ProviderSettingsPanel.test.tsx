// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ fetch: vi.fn(), update: vi.fn(), testConnection: vi.fn() }));
vi.mock("../../../api/providerSettings", () => ({
  fetchProviderSettings: api.fetch,
  updateProviderSetting: api.update,
  testProviderConnection: api.testConnection,
}));

import { ProviderSettingsProvider } from "../../../context/ProviderSettingsContext";
import { ProviderSettingsPanel } from "./ProviderSettingsPanel";

const base = {
  id: 3, provider_name: "isbndb", enabled: true, priority: 3,
  timeout_seconds: 5, max_retries: 2, has_api_key: false,
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  let provider = { ...base };
  let storedKey: string | null = null;
  api.fetch.mockImplementation(async () => [{ ...provider }]);
  api.update.mockImplementation(async (_id: number, data: Record<string, unknown>) => {
    if (typeof data.api_key === "string" && data.api_key.trim()) storedKey = data.api_key;
    if (data.clear_api_key) storedKey = null;
    provider = { ...provider, ...Object.fromEntries(Object.entries(data).filter(([key]) => key !== "api_key" && key !== "clear_api_key")), has_api_key: Boolean(storedKey) };
    return { ...provider };
  });
  api.testConnection.mockResolvedValue({ success: true, provider_id: "isbndb", duration_ms: 42, http_status: 200, error_category: null, message: null });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function showPanel() {
  render(<ProviderSettingsProvider><ProviderSettingsPanel /></ProviderSettingsProvider>);
}

it("saves a replacement without redisplaying it and retains it across unrelated changes", async () => {
  showPanel();
  expect(await screen.findByText("No stored API key configured")).toBeTruthy();
  const input = screen.getByPlaceholderText("Enter API key") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "private-isbndb-key" } });
  fireEvent.click(screen.getByRole("button", { name: "Save key" }));
  await waitFor(() => expect(screen.getByText("API key configured")).toBeTruthy());
  expect(input.value).toBe("");
  expect(document.body.textContent).not.toContain("private-isbndb-key");
  fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "4" } });
  await waitFor(() => expect(api.update).toHaveBeenCalledWith(3, { priority: 4 }));
  expect(screen.getByText("API key configured")).toBeTruthy();
});

it("explicitly clears a stored key and never pre-populates the input", async () => {
  api.fetch.mockResolvedValueOnce([{ ...base, has_api_key: true }]);
  showPanel();
  expect(await screen.findByText("API key configured")).toBeTruthy();
  const input = screen.getByPlaceholderText("Key configured — enter replacement") as HTMLInputElement;
  expect(input.value).toBe("");
  fireEvent.change(input, { target: { value: "unsubmitted-draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Remove key" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith(3, { clear_api_key: true }));
  expect(input.value).toBe("");
  expect(screen.getByText("No stored API key configured")).toBeTruthy();
});

it("keeps connection test loading and results independent by provider", async () => {
  let resolveGoogle!: (value: unknown) => void;
  api.fetch.mockResolvedValueOnce([
    { ...base, id: 1, provider_name: "google_books" },
    { ...base, id: 2, provider_name: "openlibrary" },
  ]);
  api.testConnection.mockImplementation((name: string) => name === "google_books"
    ? new Promise((resolve) => { resolveGoogle = resolve; })
    : Promise.resolve({ success: true, provider_id: name, duration_ms: 12, http_status: 200, error_category: null, message: null }));
  showPanel();
  await screen.findByText("google_books");
  const buttons = screen.getAllByRole("button", { name: "Test Connection" });
  fireEvent.click(buttons[0]);
  expect((screen.getByRole("button", { name: "Testing…" }) as HTMLButtonElement).disabled).toBe(true);
  resolveGoogle({ success: true, provider_id: "google_books", duration_ms: 25, http_status: 200, error_category: null, message: null });
  expect(await screen.findByText(/Connection successful.*25 ms.*HTTP 200/)).toBeTruthy();
});

it("explains quota exhaustion and keeps the provider diagnostic in technical details", async () => {
  api.testConnection.mockResolvedValueOnce({ success: false, provider_id: "openlibrary", duration_ms: 12, http_status: 429, error_category: "rate_limited", message: "quotaExceeded (HTTP 429)" });
  api.fetch.mockResolvedValueOnce([{ ...base, provider_name: "openlibrary" }]);
  showPanel();
  fireEvent.click(await screen.findByRole("button", { name: "Test Connection" }));
  expect(await screen.findByText(/The daily API quota has been exceeded\./)).toBeTruthy();
  fireEvent.click(screen.getByText("Technical details"));
  expect(screen.getByText("quotaExceeded (HTTP 429)")).toBeTruthy();
});
