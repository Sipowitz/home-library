import client from "./client";

import type { LibraryStats } from "../types/stats";

export type StatsRange = "7d" | "30d" | "all";

export async function getStats(range: StatsRange): Promise<LibraryStats> {
  const response = await client.get<LibraryStats>("/stats/", { params: { range } });

  return response.data;
}
