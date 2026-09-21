import client from "./client";

import type { ProviderResult } from "../types/provider";

export async function fetchMetadataCandidates(
  bookId: number,
  lookupIsbn?: string,
): Promise<ProviderResult[]> {
  const res = lookupIsbn
    ? await client.get(`/books/${bookId}/metadata-candidates`, { params: { isbn: lookupIsbn } })
    : await client.get(`/books/${bookId}/metadata-candidates`);

  return res.data;
}
