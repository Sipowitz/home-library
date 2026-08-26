import client from "./client";
import type { ReviewStatus } from "../types/book";

export type ReviewAspect = "all" | "metadata" | "covers";
export type ReviewReason = "all" | "never_reviewed" | "changed";

export type ReviewQueueBook = {
  id: number;
  title: string;
  subtitle?: string | null;
  author: string;
  isbn?: string | null;
  cover_url?: string | null;
  date_added?: string | null;
  metadata_review: ReviewStatus;
  cover_review: ReviewStatus;
};

export type ReviewQueueSummary = {
  total: number;
  metadata_never_reviewed: number;
  metadata_changed: number;
  cover_never_reviewed: number;
  cover_changed: number;
};

export type ReviewQueueResponse = {
  items: ReviewQueueBook[];
  total: number;
  skip: number;
  limit: number;
  summary: ReviewQueueSummary;
};

export async function getReviewQueue(params: {
  skip?: number;
  limit?: number;
  aspect?: ReviewAspect;
  reason?: ReviewReason;
  search?: string;
}): Promise<ReviewQueueResponse> {
  const response = await client.get("/maintenance/review-queue", { params });
  return response.data;
}
