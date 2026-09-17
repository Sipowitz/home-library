import { expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn().mockResolvedValue({ data: [] }));
vi.mock("./client", () => ({ default: { get } }));

import { getBookCollectionPaths } from "./books";

it("requests dedicated Book View Collection paths without changing normal book payloads", async () => {
  await getBookCollectionPaths(42);

  expect(get).toHaveBeenCalledWith("/books/42/collections");
});
