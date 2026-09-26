// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("../api/client", () => ({ default: { get } }));

import { AuthProvider, useAuth } from "./AuthContext";

const user = { id: 1, username: "reader", email: "reader@example.test", is_active: true, is_admin: false };

function Harness() {
  const { token, user: currentUser, logout, login } = useAuth();
  return <>
    <span data-testid="token">{token ?? "none"}</span>
    <span data-testid="user">{currentUser?.username ?? "none"}</span>
    <button onClick={logout}>logout</button>
    <button onClick={() => login("new-token")}>login</button>
  </>;
}

function renderAuth() {
  return render(<AuthProvider><Harness /></AuthProvider>);
}

beforeEach(() => {
  localStorage.clear();
  get.mockReset();
});

afterEach(cleanup);

it("restores a valid stored token", async () => {
  localStorage.setItem("token", "stored-token");
  get.mockResolvedValue({ data: user });
  renderAuth();

  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("stored-token"));
  expect(screen.getByTestId("user").textContent).toBe("reader");
});

it("clears a stored token when /auth/me returns 401", async () => {
  localStorage.setItem("token", "invalid-token");
  get.mockRejectedValue({ response: { status: 401 } });
  renderAuth();

  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("none"));
  expect(localStorage.getItem("token")).toBeNull();
});

it.each([
  ["network", new Error("network unavailable")],
  ["server", { response: { status: 503 } }],
])("preserves a stored token when /auth/me has a temporary %s failure", async (_kind, error) => {
  localStorage.setItem("token", "stored-token");
  get.mockRejectedValue(error);
  renderAuth();

  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("stored-token"));
  expect(localStorage.getItem("token")).toBe("stored-token");
});

it("keeps a newly issued token when its post-login user lookup temporarily fails", async () => {
  get.mockRejectedValue(new Error("backend restarting"));
  renderAuth();
  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("none"));
  fireEvent.click(screen.getByRole("button", { name: "login" }));

  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("new-token"));
  expect(localStorage.getItem("token")).toBe("new-token");
});

it("clears local authentication on explicit logout", async () => {
  localStorage.setItem("token", "stored-token");
  get.mockResolvedValue({ data: user });
  renderAuth();
  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("stored-token"));
  fireEvent.click(screen.getByRole("button", { name: "logout" }));

  expect(screen.getByTestId("token").textContent).toBe("none");
  expect(localStorage.getItem("token")).toBeNull();
});

it("synchronizes a logout from another tab", async () => {
  localStorage.setItem("token", "stored-token");
  get.mockResolvedValue({ data: user });
  renderAuth();
  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("stored-token"));

  localStorage.removeItem("token");
  window.dispatchEvent(new StorageEvent("storage", { key: "token", oldValue: "stored-token", newValue: null, storageArea: localStorage }));

  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("none"));
});

it("synchronizes a replacement token from another tab", async () => {
  localStorage.setItem("token", "old-token");
  get.mockResolvedValueOnce({ data: user }).mockResolvedValueOnce({ data: { ...user, username: "other" } });
  renderAuth();
  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("old-token"));

  localStorage.setItem("token", "replacement-token");
  window.dispatchEvent(new StorageEvent("storage", { key: "token", oldValue: "old-token", newValue: "replacement-token", storageArea: localStorage }));

  await waitFor(() => expect(screen.getByTestId("token").textContent).toBe("replacement-token"));
  await waitFor(() => expect(screen.getByTestId("user").textContent).toBe("other"));
});
