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

export type MaintenanceJob = {
  id: number; kind: string; status: string; total: number; processed: number;
  succeeded: number; unchanged: number; changed: number; partially_succeeded: number;
  failed: number; skipped: number; cancellation_requested: boolean;
  current_title?: string | null; error_summary?: string | null;
};

export async function startMaintenanceRefresh(kind: "metadata" | "covers") {
  const response = await client.post(`/maintenance/refresh-${kind}`);
  return response.data as MaintenanceJob;
}
export async function getActiveMaintenanceJob() {
  const response = await client.get("/maintenance/jobs/active");
  return response.data as MaintenanceJob | null;
}
export async function getMaintenanceJob(id: number) {
  const response = await client.get(`/maintenance/jobs/${id}`);
  return response.data as MaintenanceJob;
}
export async function cancelMaintenanceJob(id: number) {
  const response = await client.post(`/maintenance/jobs/${id}/cancel`);
  return response.data as MaintenanceJob;
}

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
