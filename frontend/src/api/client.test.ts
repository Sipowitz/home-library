// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn() } }));

import client from "./client";

afterEach(() => {
  localStorage.clear();
  client.defaults.adapter = undefined;
});

it("does not let a stale 401 erase a newer stored token", async () => {
  let rejectRequest: (reason: unknown) => void = () => undefined;
  let requestStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => { requestStarted = resolve; });
  client.defaults.adapter = (config) => new Promise((_, reject) => {
    rejectRequest = () => reject({ config, response: { status: 401 } });
    requestStarted();
  }) as any;
  localStorage.setItem("token", "old-token");
  const request = client.get("/books").catch(() => undefined);

  await started;
  localStorage.setItem("token", "new-token");
  rejectRequest(undefined);
  await request;

  expect(localStorage.getItem("token")).toBe("new-token");
});

it("clears authentication for a 401 from the current token", async () => {
  client.defaults.adapter = (config) => Promise.reject({ config, response: { status: 401 } }) as any;
  localStorage.setItem("token", "current-token");

  await client.get("/books").catch(() => undefined);

  expect(localStorage.getItem("token")).toBeNull();
});
