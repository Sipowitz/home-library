import { expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn().mockResolvedValue({ data: [] }));
vi.mock("./client", () => ({ default: { get } }));

import { getBookCollectionPaths, getGroupedBooks } from "./books";

it("requests dedicated Book View Collection paths without changing normal book payloads", async () => {
  await getBookCollectionPaths(42);
  expect(get).toHaveBeenCalledWith("/books/42/collections");
});

it("forwards every active grouped Library filter, including No Location", async () => {
  get.mockResolvedValue({ data: { locations: [], no_location: null } });
  await getGroupedBooks({ search: "needle", categoryId: 7, locationId: -1, read: false });
  expect(get).toHaveBeenCalledWith("/books/grouped-by-location", {
    params: { search: "needle", category_id: 7, location_id: -1, read: false },
  });
});
