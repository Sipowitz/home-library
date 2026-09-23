// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({ fetch: vi.fn(), update: vi.fn() }));
vi.mock("../../../api/providerSettings", () => ({
  fetchProviderSettings: api.fetch,
  updateProviderSetting: api.update,
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
