// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MaintenanceSettings } from "./MaintenanceSettings";

const refresh = vi.hoisted(() => vi.fn().mockResolvedValue({ items: [] }));
vi.mock("../../../hooks/useMaintenance", () => ({
  useMaintenance: () => ({ refresh, data: null, loading: false, pageSize: 50, page: 0, aspect: "all", reason: "all", search: "" }),
}));
vi.mock("../../../api/maintenance", () => ({ getActiveMaintenanceJob: vi.fn().mockResolvedValue(null) }));
vi.mock("../../books/BookView", () => ({ resolveCoverUrl: () => null }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
