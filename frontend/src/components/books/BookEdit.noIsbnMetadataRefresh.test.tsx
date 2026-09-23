// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Book } from "../../types/book";

const api = vi.hoisted(() => ({
  getBook: vi.fn(),
  getCoverCandidates: vi.fn(),
  refreshMetadata: vi.fn(),
  searchCatalogBooks: vi.fn(),
  selectCoverCandidate: vi.fn(),
}));
const fetchMetadataCandidates = vi.hoisted(() => vi.fn());
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }));
const coverBrowser = vi.hoisted(() => ({ covers: [] as Array<{ provider: string; label: string; url: string }> }));

vi.mock("../../context/PreferencesContext", () => ({ usePreferencesContext: () => ({ preferences: {} }) }));
vi.mock("../../api/metadataCandidates", () => ({ fetchMetadataCandidates }));
vi.mock("../../api/books", () => ({
  getBook: api.getBook,
  getCoverCandidates: api.getCoverCandidates,
  refreshMetadata: api.refreshMetadata,
  searchCatalogBooks: api.searchCatalogBooks,
  selectCoverCandidate: api.selectCoverCandidate,
}));
vi.mock("react-hot-toast", () => ({ default: toast }));
vi.mock("./CoverBrowserModal", () => ({
  CoverBrowserModal: ({ covers, onSelectCover }: {
    covers: Array<{ provider: string; label: string; url: string }>;
    onSelectCover?: (cover: { provider: string; label: string; url: string }) => Promise<void> | void;
  }) => {
    coverBrowser.covers = covers;
    return <button onClick={() => void onSelectCover?.({ provider: "google_books", label: "large", url: "/covers/candidate-cache/aa/candidate.jpg" })}>Select provider cover</button>;
  },
}));

import { BookEdit } from "./BookEdit";

const noIsbnBook = { id: 14, title: "The Test Book", author: "A. Author", read: false };
const isbnBook = { ...noIsbnBook, id: 15, isbn: "9780306406157" };
const providerResult = {
  provider: "google_books", success: true, isbn: "9780306406157", duration_ms: 1, error: null,
  data: { title: "Provider title", author: "Provider author", isbn: "9780306406157" },
};
const editions = [
  {
    candidate_key: "without-isbn", title: "Edition without ISBN", subtitle: null, author: "A. Author",
    publisher: "Publisher", year: 2000, isbn: null, cover_url: "https://example.test/catalog-cover.jpg", sources: ["openlibrary"],
  },
  {
    candidate_key: "with-isbn", title: "Edition with ISBN", subtitle: "Selected edition", author: "A. Author",
    publisher: "Publisher", year: 2001, isbn: "9780306406157", cover_url: "https://example.test/cover.jpg", sources: ["google_books", "openlibrary"],
  },
];

function renderEditor(book = noIsbnBook, setEditData = vi.fn()) {
  render(
    <BookEdit
      editData={book}
      setEditData={setEditData}
      categories={[]}
      locations={[]}
      textareaRef={createRef<HTMLTextAreaElement>()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return setEditData;
}

async function openRefresh() {
  fireEvent.click(screen.getByRole("button", { name: "Compare Metadata" }));
  await screen.findByRole("button", { name: "Refresh Metadata" });
  fireEvent.click(screen.getByRole("button", { name: "Refresh Metadata" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  coverBrowser.covers = [];
  api.getCoverCandidates.mockResolvedValue({ candidates: [] });
  api.getBook.mockResolvedValue({ last_metadata_refresh_at: "2026-01-01", metadata_review: { state: "never_reviewed" } });
  fetchMetadataCandidates.mockResolvedValue([providerResult]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("keeps the ISBN-bearing refresh path unchanged", async () => {
  api.refreshMetadata.mockResolvedValue([providerResult]);
  renderEditor(isbnBook);

  await openRefresh();

  await waitFor(() => expect(api.refreshMetadata).toHaveBeenCalledWith(isbnBook.id));
  expect(api.searchCatalogBooks).not.toHaveBeenCalled();
});

it("uses a promoted provider cover as a Book Edit draft value", async () => {
  const permanentUrl = "/covers/objects/sha256/aa/permanent.jpg";
  api.selectCoverCandidate.mockResolvedValue({ provider: "google_books", label: "large", url: permanentUrl });

  function DraftHarness() {
    const [draft, setDraft] = useState<Book>({ ...noIsbnBook, cover_url: "/covers/old.jpg" });
    return <>
      <BookEdit editData={draft} setEditData={setDraft} categories={[]} locations={[]} textareaRef={createRef<HTMLTextAreaElement>()} onSave={vi.fn()} onDelete={vi.fn()} />
      <output data-testid="draft-cover-url">{draft.cover_url}</output>
    </>;
  }

  render(<DraftHarness />);
  fireEvent.click(screen.getByRole("button", { name: "Select provider cover" }));

  await waitFor(() => expect(api.selectCoverCandidate).toHaveBeenCalledWith(noIsbnBook.id, {
    provider: "google_books", label: "large", url: "/covers/candidate-cache/aa/candidate.jpg",
  }));
  expect(screen.getByTestId("draft-cover-url").textContent).toBe(permanentUrl);
  expect(screen.getByAltText("Cover of The Test Book").getAttribute("src")).toBe(permanentUrl);
});

it("searches the existing title and author and requires an explicit edition selection", async () => {
  api.searchCatalogBooks.mockResolvedValue(editions);
  renderEditor();

  await openRefresh();

  await waitFor(() => expect(api.searchCatalogBooks).toHaveBeenCalledWith("The Test Book", "A. Author"));
  expect(screen.getByText("Edition without ISBN")).toBeTruthy();
  expect(screen.getByText("Edition with ISBN")).toBeTruthy();
  expect(screen.getByText("google_books · openlibrary")).toBeTruthy();
  expect(api.refreshMetadata).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: /Edition without ISBN/ }) as HTMLButtonElement).disabled).toBe(false);
});

it("uses the selected ISBN only for temporary refresh and candidate retrieval", async () => {
  const setEditData = vi.fn();
  api.searchCatalogBooks.mockResolvedValue(editions);
  api.refreshMetadata.mockResolvedValue([providerResult]);
  renderEditor(noIsbnBook, setEditData);

  await openRefresh();
  await screen.findByText("Edition with ISBN");
  fireEvent.click(screen.getByRole("button", { name: /Edition with ISBN/ }));

  await waitFor(() => expect(api.refreshMetadata).toHaveBeenCalledTimes(1));
  expect(api.refreshMetadata).toHaveBeenCalledWith(noIsbnBook.id, "9780306406157");
  await waitFor(() => expect(fetchMetadataCandidates).toHaveBeenCalledWith(noIsbnBook.id, "9780306406157"));
  expect(await screen.findByRole("heading", { name: "Metadata Comparison" })).toBeTruthy();
  expect(setEditData).toHaveBeenCalledWith(expect.not.objectContaining({ isbn: "9780306406157" }));
});

it("opens comparison from an ISBN-less catalog result without refreshing or changing the book", async () => {
  const setEditData = vi.fn();
  api.searchCatalogBooks.mockResolvedValue(editions);
  fetchMetadataCandidates.mockResolvedValue([]);
  renderEditor(noIsbnBook, setEditData);

  await openRefresh();
  await screen.findByText("Edition without ISBN");
  fireEvent.click(screen.getByRole("button", { name: /Edition without ISBN/ }));

  expect(api.refreshMetadata).not.toHaveBeenCalled();
  expect(await screen.findByRole("heading", { name: "Metadata Comparison" })).toBeTruthy();
  expect(screen.getByText("Edition without ISBN")).toBeTruthy();
  expect(screen.getByText("A. Author")).toBeTruthy();
  expect(screen.getAllByText("Publisher").length).toBeGreaterThan(1);
  expect(screen.getByText("2000")).toBeTruthy();
  expect(screen.getAllByText("Openlibrary").length).toBeGreaterThan(0);
  expect(screen.queryByText("9780306406157")).toBeNull();
  expect(screen.queryByRole("heading", { name: "ISBN" })).toBeNull();
  expect(setEditData).not.toHaveBeenCalled();

  expect(coverBrowser.covers).toContainEqual({
    provider: "openlibrary",
    label: "Catalog result",
    url: "https://example.test/catalog-cover.jpg",
  });
});

it("cancels the edition picker without refreshing or changing the book", async () => {
  const setEditData = vi.fn();
  api.searchCatalogBooks.mockResolvedValue(editions);
  renderEditor(noIsbnBook, setEditData);

  await openRefresh();
  await screen.findByText("Edition with ISBN");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(screen.queryByText("Find matching edition")).toBeNull();
  expect(api.refreshMetadata).not.toHaveBeenCalled();
  expect(setEditData).not.toHaveBeenCalled();
});

it("shows concise no-match and catalog-search failure states", async () => {
  api.searchCatalogBooks.mockResolvedValueOnce([]);
  renderEditor();
  await openRefresh();
  expect(await screen.findByText("No matching catalog editions found.")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  api.searchCatalogBooks.mockRejectedValueOnce(new Error("network"));
  await openRefresh();
  expect(await screen.findByText("Catalog search could not be completed. Please try again.")).toBeTruthy();
});

it("keeps temporary refresh and candidate-loading failures non-destructive", async () => {
  const setEditData = vi.fn();
  api.searchCatalogBooks.mockResolvedValue(editions);
  api.refreshMetadata.mockRejectedValueOnce(new Error("refresh failed"));
  renderEditor(noIsbnBook, setEditData);

  await openRefresh();
  await screen.findByText("Edition with ISBN");
  fireEvent.click(screen.getByRole("button", { name: /Edition with ISBN/ }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Metadata refresh failed"));
  expect(setEditData).not.toHaveBeenCalled();

  cleanup();
  api.searchCatalogBooks.mockResolvedValue(editions);
  api.refreshMetadata.mockResolvedValue([providerResult]);
  fetchMetadataCandidates.mockImplementation((_bookId, isbn) => (
    isbn ? Promise.reject(new Error("candidates failed")) : Promise.resolve([])
  ));
  renderEditor(noIsbnBook);
  await openRefresh();
  await screen.findByText("Edition with ISBN");
  fireEvent.click(screen.getByRole("button", { name: /Edition with ISBN/ }));
  expect(await screen.findByText("Failed to load metadata candidates")).toBeTruthy();
});
