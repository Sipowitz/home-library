// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

const searchCatalogBooks = vi.hoisted(() => vi.fn());

vi.mock("../../api/books", () => ({ searchCatalogBooks }));
vi.mock("../../hooks/useISBNScanner", () => ({
  useISBNScanner: () => ({
    scannerOpen: false,
    setScannerOpen: vi.fn(),
    torchOn: false,
    torchSupported: false,
    toggleTorch: vi.fn(),
    stopScanner: vi.fn(),
  }),
}));

import { AddBookForm } from "./AddBookForm";

const candidate = (index: number, isbn: string | null = null) => ({
  candidate_key: `candidate-${index}`,
  title: `Book ${index}`,
  subtitle: index === 0 ? "A subtitle" : null,
  author: "An Author",
  publisher: "Publisher",
  year: 1997,
  isbn,
  cover_url: null,
  sources: ["openlibrary"],
});

function Harness({ initial = {} }: { initial?: Record<string, unknown> }) {
  const [newBook, setNewBook] = useState(initial);
  return (
    <AddBookForm
      newBook={newBook}
      setNewBook={setNewBook}
      onSearch={vi.fn()}
      onAdd={vi.fn().mockResolvedValue(undefined)}
      onAddReview={vi.fn().mockResolvedValue(undefined)}
      canAddReview={false}
      onReset={vi.fn()}
      onISBNChange={vi.fn()}
      onCatalogCandidateSelected={(draft) => setNewBook(draft)}
      isFetching={false}
    />
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("has one disabled Search button until ISBN or Title is entered", () => {
  render(<Harness />);
  const search = screen.getByRole("button", { name: "Search" });
  expect((search as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: /look up isbn/i })).toBeNull();
  fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "A title" } });
  expect((search as HTMLButtonElement).disabled).toBe(false);
});

it("uses the existing ISBN search from the one Search button", () => {
  const onSearch = vi.fn();
  render(
    <AddBookForm
      newBook={{ isbn: "9780306406157" }} setNewBook={vi.fn()} onSearch={onSearch}
      onAdd={vi.fn()} onAddReview={vi.fn()} canAddReview={false} onReset={vi.fn()}
      onISBNChange={vi.fn()} isFetching={false}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  expect(onSearch).toHaveBeenCalledOnce();
});

it("keeps the ISBN scanner available", () => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
  render(<Harness />);
  expect(screen.getByRole("button", { name: "Scan ISBN with camera" })).toBeTruthy();
});

it("searches catalog by title and optional author, then reveals more without another request", async () => {
  searchCatalogBooks.mockResolvedValue(Array.from({ length: 21 }, (_, index) => candidate(index)));
  render(<Harness />);
  fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "The Book" } });
  fireEvent.change(screen.getByPlaceholderText("Author"), { target: { value: "Author" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));

  await waitFor(() => expect(searchCatalogBooks).toHaveBeenCalledWith("The Book", "Author"));
  expect(screen.getAllByRole("button", { name: /Book \d/ })).toHaveLength(10);
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  expect(screen.getAllByRole("button", { name: /Book \d/ })).toHaveLength(20);
  expect(searchCatalogBooks).toHaveBeenCalledOnce();
});

it("searches the catalog by title alone", async () => {
  searchCatalogBooks.mockResolvedValue([]);
  render(<Harness />);
  fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "The Book" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(searchCatalogBooks).toHaveBeenCalledWith("The Book", undefined));
});

it("shows no-results and error states", async () => {
  searchCatalogBooks.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error("offline"));
  render(<Harness />);
  fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Missing" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(screen.getByText("No catalog results found.")).toBeTruthy());

  fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Retry" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => expect(screen.getByText(/Catalog search could not be completed/)).toBeTruthy());
});

it("selects an ISBN-less candidate into the existing draft", async () => {
  searchCatalogBooks.mockResolvedValue([candidate(0)]);
  render(<Harness />);
  fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "The Book" } });
  fireEvent.click(screen.getByRole("button", { name: "Search" }));
  await waitFor(() => screen.getByRole("button", { name: /Book 0/ }));
  fireEvent.click(screen.getByRole("button", { name: /Book 0/ }));

  expect((screen.getByPlaceholderText("Title") as HTMLInputElement).value).toBe("Book 0");
  expect((screen.getByPlaceholderText("Author") as HTMLInputElement).value).toBe("An Author");
  expect((screen.getByPlaceholderText("Scan or enter ISBN...") as HTMLInputElement).value).toBe("");
  expect(screen.getByText(/Catalog result selected/)).toBeTruthy();
});

it("keeps ISBN and title/author modes exclusive", () => {
  render(<Harness />);
  fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Catalog title" } });
  fireEvent.change(screen.getByPlaceholderText("Scan or enter ISBN..."), { target: { value: "9780306406157" } });
  expect((screen.getByPlaceholderText("Title") as HTMLInputElement).value).toBe("");
  expect((screen.getByPlaceholderText("Title") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByPlaceholderText("Author") as HTMLInputElement).disabled).toBe(true);
});
