// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MaintenanceSettings } from "./MaintenanceSettings";

const refresh = vi.hoisted(() => vi.fn().mockResolvedValue({ items: [] }));
const maintenanceApi = vi.hoisted(() => ({
  getActiveMaintenanceJob: vi.fn().mockResolvedValue(null),
  getMaintenanceJob: vi.fn(),
  startMaintenanceRefresh: vi.fn(),
  rescanAllCoverArt: vi.fn(),
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));
vi.mock("../../../hooks/useMaintenance", () => ({
  useMaintenance: () => ({ refresh, data: null, loading: false, pageSize: 50, page: 0, aspect: "all", reason: "all", search: "" }),
}));
vi.mock("../../../api/maintenance", () => ({ ...maintenanceApi }));
vi.mock("react-hot-toast", () => ({ default: toast }));
vi.mock("../../books/BookView", () => ({ resolveCoverUrl: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const runningRescan = {
  id: 9, kind: "cover_rescan", status: "running", total: 342, processed: 127,
  succeeded: 125, unchanged: 0, changed: 125, partially_succeeded: 0,
  failed: 1, skipped: 1, cancellation_requested: false,
  cover_rescan_counts: { books_processed: 127, skipped_no_isbn: 1, provider_lookups: 375,
    candidates_discovered: 700, candidates_stored: 695, failed_downloads: 5, provider_failures: 1 },
};

it("starts a cover-art rescan, shows progress, and prevents duplicate starts", async () => {
  maintenanceApi.rescanAllCoverArt.mockResolvedValue(runningRescan);
  maintenanceApi.getMaintenanceJob.mockResolvedValue({ ...runningRescan, status: "completed", processed: 342 });
  render(<MaintenanceSettings active onReview={vi.fn()} onReviewSequenceComplete={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Refresh All Metadata" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Rescan All Cover Art" }));
  fireEvent.click(screen.getByRole("button", { name: "Start Rescan" }));
  await waitFor(() => expect(maintenanceApi.rescanAllCoverArt).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Rescanning cover art…")).toBeTruthy();
  expect(screen.getByText("127 / 342")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Rescan All Cover Art" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Refresh All Metadata" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByText(/695 stored locally/)).toBeTruthy();
});

it("shows a completed rescan and re-enables the action", async () => {
  maintenanceApi.getActiveMaintenanceJob.mockResolvedValueOnce({ ...runningRescan, status: "completed", processed: 342 });
  render(<MaintenanceSettings active onReview={vi.fn()} onReviewSequenceComplete={vi.fn()} />);
  await waitFor(() => expect(screen.getByText("Cover art rescan complete")).toBeTruthy());
  expect(screen.getByText("Cover art rescan complete")).toBeTruthy();
  expect(screen.getByText("342 / 342")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Rescan All Cover Art" }) as HTMLButtonElement).disabled).toBe(false);
});

it("shows a failed rescan without leaving the action disabled", async () => {
  maintenanceApi.getActiveMaintenanceJob.mockResolvedValueOnce({
    ...runningRescan, status: "failed", error_summary: "Interrupted by backend restart",
  });
  render(<MaintenanceSettings active onReview={vi.fn()} onReviewSequenceComplete={vi.fn()} />);
  await waitFor(() => expect(screen.getByText("Cover art rescan failed")).toBeTruthy());
  expect(screen.getByText("Interrupted by backend restart")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Rescan All Cover Art" }) as HTMLButtonElement).disabled).toBe(false);
});

it("handles rescan start failure and leaves metadata refresh available", async () => {
  maintenanceApi.rescanAllCoverArt.mockRejectedValue(new Error("unavailable"));
  maintenanceApi.startMaintenanceRefresh.mockResolvedValue({ ...runningRescan, kind: "metadata_refresh" });
  render(<MaintenanceSettings active onReview={vi.fn()} onReviewSequenceComplete={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Rescan All Cover Art" }));
  fireEvent.click(screen.getByRole("button", { name: "Start Rescan" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect((screen.getByRole("button", { name: "Rescan All Cover Art" }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Refresh All Metadata" }));
  fireEvent.click(screen.getByRole("button", { name: "Start Refresh" }));
  await waitFor(() => expect(maintenanceApi.startMaintenanceRefresh).toHaveBeenCalledWith("metadata"));
});

it("reloads on evidence changes without saving or advancing guided review, including changes while inactive", async () => {
  const callbacks = { onReview: vi.fn(), onReviewSequenceComplete: vi.fn() };
  const { rerender } = render(<MaintenanceSettings active evidenceRefreshVersion={0} {...callbacks} />);
  rerender(<MaintenanceSettings active evidenceRefreshVersion={1} {...callbacks} />);
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  rerender(<MaintenanceSettings active evidenceRefreshVersion={1} {...callbacks} />);
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender(<MaintenanceSettings active={false} evidenceRefreshVersion={2} {...callbacks} />);
  expect(refresh).toHaveBeenCalledTimes(1);
  rerender(<MaintenanceSettings active evidenceRefreshVersion={2} {...callbacks} />);
  await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
  expect(callbacks.onReview).not.toHaveBeenCalled();
  expect(callbacks.onReviewSequenceComplete).not.toHaveBeenCalled();
});
