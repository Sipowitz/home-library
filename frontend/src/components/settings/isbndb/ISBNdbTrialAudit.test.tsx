// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ status: vi.fn(), results: vi.fn(), result: vi.fn(), run: vi.fn() }));
vi.mock("../../../api/isbndbAudit", () => ({
  getISBNdbAuditStatus: api.status, getISBNdbAuditResults: api.results,
  getISBNdbAuditResult: api.result, runISBNdbAuditBatch: api.run,
}));
import { ISBNdbTrialAudit } from "./ISBNdbTrialAudit";

const summary = { configured: true, total_books: 2, books_with_isbn: 2, unique_isbns: 2, checked: 1, found: 1, not_found: 0, errors: 0, remaining: 1, quota: { total: 5000, left: 4999 }, coverage: { title: { count: 1, percentage: 100 } } };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it("shows resumable read-only audit progress and a safe text comparison", async () => {
  api.status.mockResolvedValue(summary); api.results.mockResolvedValue([{ book_id: 1, isbn: "9780", status: "found", title: "Audit book" }]);
  api.result.mockResolvedValue({ book: { title: "Saved" }, status: "found", isbndb: { title: "Remote", synopsis: "<b>Untrusted</b>", binding: "Paperback", subjects: ["Fiction"] } });
  render(<ISBNdbTrialAudit />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue Audit" })).toBeTruthy());
  expect(screen.getByText("4999", { exact: false })).toBeTruthy();
  expect(screen.queryByText(/Apply|Import|Update Book/)).toBeNull();
  fireEvent.click(screen.getByText("Audit book"));
  await waitFor(() => expect(screen.getByText("<b>Untrusted</b>")).toBeTruthy());
  expect(screen.getByText("Binding:", { exact: false })).toBeTruthy();
});

it("reports missing configuration without a run control", async () => {
  api.status.mockResolvedValue({ ...summary, configured: false, quota: null }); api.results.mockResolvedValue([]);
  render(<ISBNdbTrialAudit />);
  await waitFor(() => expect(screen.getByText(/ISBNdb is not configured/)).toBeTruthy());
  expect(screen.queryByRole("button", { name: /Audit/ })).toBeNull();
});
