import { expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn().mockResolvedValue({ data: {} }));
vi.mock("./client", () => ({ default: { get } }));

import { browseRootCollections } from "./collections";

it("requests subsequent unified-root pages with their combined-sequence offset", async () => {
  await browseRootCollections({ rootMode: "collections_and_books", skip: 100 });

  expect(get).toHaveBeenCalledWith("/series/browse", {
    params: expect.objectContaining({ root_mode: "collections_and_books", skip: 100, limit: 100 }),
  });
});
