import client from "./client";

import type { ProviderResult } from "../types/provider";

export async function fetchProviderResultsByISBN(
  isbn: string,
): Promise<ProviderResult[]> {
  const res = await client.get(`/books/provider-results/${isbn}`);

  return res.data;
}
