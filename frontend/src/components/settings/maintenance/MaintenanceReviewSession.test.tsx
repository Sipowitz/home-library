// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Book } from "../../../types/book";
import { MaintenanceReviewSession } from "./MaintenanceReviewSession";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(), getBook: vi.fn(), notify: vi.fn(), success: vi.fn(), error: vi.fn(),
  panel: { current: {} as { onRefreshMetadata: () => Promise<unknown>; currentData: Book } },
}));
vi.mock("../../../api/books", () => ({
  refreshMetadata: mocks.refresh,
  getBook: mocks.getBook,
  getCoverCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
}));
vi.mock("react-hot-toast", () => ({
  default: Object.assign(mocks.notify, { success: mocks.success, error: mocks.error }),
}));
vi.mock("../../books/CoverBrowserModal", () => ({ CoverBrowserModal: () => null }));
vi.mock("../../books/MetadataComparisonPanel", () => ({
  MetadataComparisonPanel: (props: typeof mocks.panel.current & { isRefreshing: boolean; onClose: () => void }) => {
    mocks.panel.current = props;
    return <><button disabled={props.isRefreshing} onClick={() => void props.onRefreshMetadata()}>
      {props.isRefreshing ? "Refreshing..." : "Refresh Metadata"}
    </button><button onClick={props.onClose}>Close</button></>;
  },
}));

const book = { id: 42, isbn: "9780140328721", title: "Saved title" } as Book;
const success = { provider: "google_books", success: true, data: { title: "Fresh title" } };
const failure = { provider: "openlibrary", success: false, data: null };

function setup(isbn = book.isbn) {
  const callbacks = { onSave: vi.fn(), onSaved: vi.fn(), onCancel: vi.fn(), onEvidenceRefreshed: vi.fn() };
  render(<MaintenanceReviewSession book={{ ...book, isbn }} initialTarget="metadata"
    origin="maintenance_guided" followUp={null} {...callbacks} />);
  return callbacks;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getBook.mockResolvedValue({ ...book, last_metadata_refresh_at: "2026-09-13" });
  mocks.refresh.mockResolvedValue([success]);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Maintenance single-book metadata refresh", () => {
  it("rejects a whitespace-only ISBN without a request", async () => {
    setup("   ");
    await act(async () => { await mocks.panel.current.onRefreshMetadata(); });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith("Add an ISBN before refreshing metadata");
  });

  it("guards simultaneous requests, exposes progress and signals evidence without saving", async () => {
    let resolve!: (value: unknown[]) => void;
    mocks.refresh.mockReturnValue(new Promise((done) => { resolve = done; }));
    const callbacks = setup();
    let pending!: Promise<unknown>;
    act(() => {
      const refresh = mocks.panel.current.onRefreshMetadata;
      pending = refresh();
      void refresh();
    });
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.refresh).toHaveBeenCalledWith(42);
    expect((screen.getByText("Refreshing...") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { resolve([success]); await pending; });
    expect(mocks.panel.current.currentData.title).toBe("Saved title");
    expect(mocks.panel.current.currentData.last_metadata_refresh_at).toBe("2026-09-13");
    expect(callbacks.onEvidenceRefreshed).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("Close"));
    expect(callbacks.onCancel).toHaveBeenCalledOnce();
    expect(callbacks.onSave).not.toHaveBeenCalled();
    expect(callbacks.onSaved).not.toHaveBeenCalled();
    expect(screen.getByText("Refresh Metadata")).toBeTruthy();
  });

  it.each([
    [[success], "success", "Metadata refreshed from 1 provider"],
    [[success, failure], "notify", "1 failed (openlibrary)"],
    [[failure], "error", "failed for all providers"],
    [[], "notify", "No provider results returned"],
  ] as const)("reports provider outcome %#", async (results, notification, message) => {
    mocks.refresh.mockResolvedValue(results);
    setup();
    await act(async () => { await mocks.panel.current.onRefreshMetadata(); });
    expect(mocks[notification]).toHaveBeenCalledWith(expect.stringContaining(message));
  });

  it("shows the API error, releases the guard, and allows retry", async () => {
    mocks.refresh.mockRejectedValueOnce({ isAxiosError: true, response: { data: { message: "Book 42 has no ISBN" } } });
    const callbacks = setup();
    await act(async () => { await mocks.panel.current.onRefreshMetadata(); });
    expect(mocks.error).toHaveBeenCalledWith("Book 42 has no ISBN");
    expect(callbacks.onEvidenceRefreshed).not.toHaveBeenCalled();
    await act(async () => { await mocks.panel.current.onRefreshMetadata(); });
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
    expect(callbacks.onEvidenceRefreshed).toHaveBeenCalledOnce();
  });

  it("retains POST results and signals the queue when the subsequent book reload fails", async () => {
    mocks.getBook.mockRejectedValue(new Error("offline"));
    const callbacks = setup();
    let results: unknown;
    await act(async () => { results = await mocks.panel.current.onRefreshMetadata(); });
    expect(results).toEqual([success]);
    expect(callbacks.onEvidenceRefreshed).toHaveBeenCalledOnce();
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining("review status could not be reloaded"));
    await waitFor(() => expect(screen.getByText("Refresh Metadata")).toBeTruthy());
  });
});
