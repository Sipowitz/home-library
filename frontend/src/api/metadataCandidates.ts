import client from "./client";

import type { ProviderResult } from "../types/provider";

export async function fetchMetadataCandidates(
  bookId: number,
): Promise<ProviderResult[]> {
  const res = await client.get(`/books/${bookId}/metadata-candidates`);

  return res.data;
}
