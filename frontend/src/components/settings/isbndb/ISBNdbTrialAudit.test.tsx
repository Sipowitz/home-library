// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ status: vi.fn(), results: vi.fn(), result: vi.fn(), run: vi.fn(), retry: vi.fn() }));
vi.mock("../../../api/isbndbAudit", () => ({
  getISBNdbAuditStatus: api.status, getISBNdbAuditResults: api.results,
  getISBNdbAuditResult: api.result, runISBNdbAuditBatch: api.run,
  retryISBNdbAuditErrors: api.retry,
}));
import { ISBNdbTrialAudit } from "./ISBNdbTrialAudit";

const summary = { configured: true, total_books: 2, books_with_isbn: 2, unique_isbns: 2, checked: 1, found: 1, not_found: 0, errors: 0, remaining: 1, quota: { total: 5000, left: 4999 }, coverage: { title: { count: 1, percentage: 100 } } };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("shows resumable read-only audit progress and a safe text comparison", async () => {
  api.status.mockResolvedValue(summary); api.results.mockResolvedValue([{ book_id: 1, isbn: "9780", status: "found", title: "Audit book" }]);
  api.result.mockResolvedValue({ book: { title: "Saved", cover_url: "/covers/library.jpg" }, status: "found", isbndb: { title: "Remote", image: "https://images.isbndb.com/cover.jpg", synopsis: "<b>Untrusted</b>", binding: "Paperback", subjects: ["Fiction"], dimensions_structured: { height: { value: 7.76, unit: "inches" }, width: { value: 0.93, unit: "inches" }, length: { value: 5.08, unit: "inches" }, weight: { value: 0.51, unit: "pounds" } } } });
  render(<ISBNdbTrialAudit />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue Audit" })).toBeTruthy());
  expect(screen.getByText("4999", { exact: false })).toBeTruthy();
  expect(screen.queryByText(/Apply|Import|Update Book/)).toBeNull();
  fireEvent.click(screen.getByText("Audit book"));
  await waitFor(() => expect(screen.getByText("<b>Untrusted</b>")).toBeTruthy());
  expect(screen.getByText("Binding:", { exact: false })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Library cover" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "ISBNdb cover" })).toBeTruthy();
  expect(screen.getByText("Height:", { exact: false })).toBeTruthy();
  expect(screen.getByText("7.76 inches")).toBeTruthy();
  expect(screen.getByText("0.51 pounds")).toBeTruthy();
  expect(screen.queryByText("[object Object]")).toBeNull();
});

it("handles missing covers and partial structured dimensions", async () => {
  api.status.mockResolvedValue(summary); api.results.mockResolvedValue([{ book_id: 1, isbn: "9780", status: "found", title: "Audit book" }]);
  api.result.mockResolvedValue({ book: { title: "Saved" }, status: "found", isbndb: { dimensions_structured: { weight: { value: 1, unit: "pounds" }, height: null } } });
  render(<ISBNdbTrialAudit />);
  await waitFor(() => expect(screen.getByText("Audit book")).toBeTruthy());
  fireEvent.click(screen.getByText("Audit book"));
  await waitFor(() => expect(screen.getAllByText("No cover")).toHaveLength(2));
  expect(screen.getByText("Weight:", { exact: false })).toBeTruthy();
  expect(screen.getByText("1 pounds")).toBeTruthy();
  expect(screen.queryByText("[object Object]")).toBeNull();
});

it("reports missing configuration without a run control", async () => {
  api.status.mockResolvedValue({ ...summary, configured: false, quota: null }); api.results.mockResolvedValue([]);
  render(<ISBNdbTrialAudit />);
  await waitFor(() => expect(screen.getByText(/ISBNdb is not configured/)).toBeTruthy());
  expect(screen.queryByRole("button", { name: /Audit/ })).toBeNull();
});

it("shows Retry Errors only when errors exist and refreshes after one retry batch", async () => {
  const errors = { ...summary, errors: 2, remaining: 0 };
  api.status.mockResolvedValueOnce(errors).mockResolvedValueOnce({ ...errors, errors: 1, found: 2 });
  api.results.mockResolvedValue([]); api.retry.mockResolvedValue({ ...errors, errors: 1, found: 2 });
  render(<ISBNdbTrialAudit />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry Errors (2)" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Retry Errors (2)" }));
  expect(api.retry).toHaveBeenCalledOnce();
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry Errors (1)" })).toBeTruthy());
});
