import { expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {} }));
vi.mock("./client", () => ({ default: { get } }));

import { browseCollection, browseRootCollections } from "./collections";

it("requests subsequent unified-root pages with their combined-sequence offset", async () => {
  await browseRootCollections({ rootMode: "collections_and_books", skip: 100 });

  expect(get).toHaveBeenCalledWith("/series/browse", {
    params: expect.objectContaining({ root_mode: "collections_and_books", skip: 100, limit: 100 }),
  });
});

it("requests subsequent collection book pages with their book-result offset", async () => {
  await browseCollection(42, { sort: "publication", skip: 100 });

  expect(get).toHaveBeenCalledWith("/series/42/browse", {
    params: expect.objectContaining({ sort: "publication", skip: 100, limit: 100 }),
  });
});
