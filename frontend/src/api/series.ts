import axios from "axios";

import client from "./client";

import type {
  Series,
  SeriesTreeNode,
  SeriesUpdateInput,
  SeriesWriteInput,
} from "../types/series";

export async function fetchSeriesTree(): Promise<SeriesTreeNode[]> {
  const response = await client.get<SeriesTreeNode[]>("/series/");
  return response.data;
}

export async function fetchSeries(id: number): Promise<Series> {
  const response = await client.get<Series>(`/series/${id}`);
  return response.data;
}

export async function createSeries(data: SeriesWriteInput): Promise<Series> {
  const response = await client.post<Series>("/series/", data);
  return response.data;
}

export async function updateSeries(
  id: number,
  data: SeriesUpdateInput,
): Promise<Series> {
  const response = await client.patch<Series>(`/series/${id}`, data);
  return response.data;
}

export async function deleteSeries(id: number): Promise<void> {
  await client.delete(`/series/${id}`);
}

export function seriesApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;

  const payload = error.response?.data as
    | { message?: unknown; detail?: unknown }
    | undefined;
  const message = payload?.message ?? payload?.detail;

  if (typeof message === "string" && message.trim()) return message;
  if (
    message &&
    typeof message === "object" &&
    "message" in message &&
    typeof message.message === "string"
  ) {
    return message.message;
  }

  return fallback;
}
