import { expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {} }));

vi.mock("./client", () => ({ default: { get } }));

import { getStats } from "./stats";

it("requests the selected backend chart range", async () => {
  await getStats("7d");

  expect(get).toHaveBeenCalledWith("/stats/", { params: { range: "7d" } });
});
