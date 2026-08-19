import client from "./client";

import type { LibraryStats } from "../types/stats";

export async function getStats(): Promise<LibraryStats> {
  const response = await client.get<LibraryStats>("/stats/");

  return response.data;
}
