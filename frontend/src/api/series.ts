import axios from "axios";

import client from "./client";

import type {
  EffectiveSeriesBook,
  Series,
  SeriesMembership,
  SeriesOrdering,
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

export async function fetchEffectiveSeriesBooks(seriesId: number): Promise<EffectiveSeriesBook[]> {
  const response = await client.get<EffectiveSeriesBook[]>(`/series/${seriesId}/books`);
  return response.data;
}

export async function addSeriesMembership(seriesId: number, bookId: number): Promise<SeriesMembership> {
  const response = await client.post<SeriesMembership>(`/series/${seriesId}/books`, {
    book_id: bookId,
  });
  return response.data;
}

export async function updateSeriesMembership(
  seriesId: number,
  bookId: number,
  nodeOrder: string | null,
): Promise<SeriesMembership> {
  const response = await client.patch<SeriesMembership>(`/series/${seriesId}/books/${bookId}`, {
    node_order: nodeOrder,
  });
  return response.data;
}

export async function removeSeriesMembership(seriesId: number, bookId: number): Promise<void> {
  await client.delete(`/series/${seriesId}/books/${bookId}`);
}

export async function setSeriesOrdering(
  seriesId: number,
  bookId: number,
  ordering: Partial<{ publication_order: string | null; chronological_order: string | null }>,
): Promise<SeriesOrdering | null> {
  const response = await client.put<SeriesOrdering | null>(
    `/series/${seriesId}/books/${bookId}/ordering`,
    ordering,
  );
  return response.data;
}

export async function removeSeriesOrdering(seriesId: number, bookId: number): Promise<void> {
  await client.delete(`/series/${seriesId}/books/${bookId}/ordering`);
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
