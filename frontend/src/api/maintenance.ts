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
  cover_cache_counts?: { total_considered: number; cached: number; already_local: number; no_cover: number; failed: number; skipped: number } | null;
  cover_cache_cleanup_counts?: { candidate_scanned: number; candidate_retained: number; candidate_deleted: number; candidate_skipped: number; candidate_failed: number; staging_scanned: number; staging_retained: number; staging_deleted: number; staging_skipped: number; staging_failed: number } | null;
  cover_rescan_counts?: { books_processed: number; skipped_no_isbn: number; provider_lookups: number; candidates_discovered: number; candidates_stored: number; failed_downloads: number; provider_failures: number } | null;
};

export async function startMaintenanceRefresh(kind: "metadata" | "covers") {
  const response = await client.post(`/maintenance/refresh-${kind}`);
  return response.data as MaintenanceJob;
}
export async function cacheExistingCovers() {
  const response = await client.post("/maintenance/cache-existing-covers");
  return response.data as MaintenanceJob;
}
export async function rescanAllCoverArt() {
  const response = await client.post("/maintenance/rescan-cover-art");
  return response.data as MaintenanceJob;
}
export async function cleanCoverCache() {
  const response = await client.post("/maintenance/clean-cover-cache");
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
