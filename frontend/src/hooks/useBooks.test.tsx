// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useBooks } from "./useBooks";
import type { Location } from "../types/location";

const getBooks = vi.hoisted(() => vi.fn());
const deleteBook = vi.hoisted(() => vi.fn());
const updateBook = vi.hoisted(() => vi.fn());
const locationContext = vi.hoisted(() => ({ locations: [] as Location[] }));

vi.mock("../api/books", () => ({ getBooks, createBook: vi.fn(), createBookFromISBN: vi.fn(), deleteBook, updateBook }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ ready: true, token: "test-token" }) }));
vi.mock("../context/LocationContext", () => ({ useLocations: () => locationContext }));

const page = (start: number) => ({
  items: Array.from({ length: 20 }, (_, index) => ({ id: start + index, title: `Book ${start + index}`, author: "Author", location_id: 1 })),
  total: 60,
});

function Harness() {
  const { books, saveBook, removeBook, loadMoreBooks, hasMore } = useBooks();
  const laterBook = books.find((book) => book.id === 45);
  return <><div data-testid="book-count">{books.length}</div><div data-testid="later-book">{laterBook ? `${laterBook.id}:${laterBook.location_id}` : "missing"}</div>{hasMore && <button onClick={() => void loadMoreBooks()}>load more</button>}<button disabled={!laterBook} onClick={() => void saveBook({ ...laterBook!, location_id: 2 })}>save</button><button disabled={!laterBook} onClick={() => void removeBook(laterBook!.id)}>delete</button></>;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

function LocationFilterHarness({ locationId, nextLocationId }: { locationId: number; nextLocationId: number | null }) {
  const { books, saveBook, updateFilters } = useBooks();
  useEffect(() => { updateFilters({ locationId }); }, [locationId]);
  const book = books[0];
  return <><div data-testid="book-count">{books.length}</div><div data-testid="book-location">{book?.location_id ?? "missing"}</div><button disabled={!book} onClick={() => void saveBook({ ...book!, location_id: nextLocationId })}>save filtered book</button></>;
}

it("merges an edited later-page book without resetting loaded pages or pagination", async () => {
  getBooks.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(21)).mockResolvedValueOnce(page(41));
  updateBook.mockResolvedValue({ id: 45, title: "Book 45", author: "Author", location_id: 2 });

  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("book-count").textContent).toBe("20"));
  await act(async () => { screen.getByRole("button", { name: "load more" }).click(); });
  await waitFor(() => expect(screen.getByTestId("book-count").textContent).toBe("40"));
  await act(async () => { screen.getByRole("button", { name: "load more" }).click(); });
  await waitFor(() => expect(screen.getByTestId("book-count").textContent).toBe("60"));

  await act(async () => { screen.getByRole("button", { name: "save" }).click(); });
  expect(screen.getByTestId("book-count").textContent).toBe("60");
  expect(screen.getByTestId("later-book").textContent).toBe("45:2");
  expect(getBooks).toHaveBeenCalledTimes(3);
});

it("removes only a deleted loaded book without resetting loaded pages or pagination", async () => {
  getBooks.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(21)).mockResolvedValueOnce(page(41));
  deleteBook.mockResolvedValue(undefined);

  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("book-count").textContent).toBe("20"));
  await act(async () => { screen.getByRole("button", { name: "load more" }).click(); });
  await act(async () => { screen.getByRole("button", { name: "load more" }).click(); });
  await waitFor(() => expect(screen.getByTestId("book-count").textContent).toBe("60"));

  await act(async () => { screen.getByRole("button", { name: "delete" }).click(); });
  expect(screen.getByTestId("book-count").textContent).toBe("59");
  expect(screen.getByTestId("later-book").textContent).toBe("missing");
  expect(getBooks).toHaveBeenCalledTimes(3);
});

it("removes a book moved outside the active Location filter without reloading", async () => {
  locationContext.locations = [{ id: 1, name: "Shelf A", parent_id: null, child_count: 0, stats: { total_books: 1 } }, { id: 2, name: "Shelf B", parent_id: null, child_count: 0, stats: { total_books: 0 } }];
  getBooks.mockResolvedValue({ items: [{ id: 1, title: "Moved", author: "Author", location_id: 1 }], total: 1 });
  updateBook.mockResolvedValue({ id: 1, title: "Moved", author: "Author", location_id: 2 });

  render(<LocationFilterHarness locationId={1} nextLocationId={2} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "save filtered book" }) as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { screen.getByRole("button", { name: "save filtered book" }).click(); });
  expect(screen.getByTestId("book-count").textContent).toBe("0");
  expect(getBooks).toHaveBeenCalledTimes(2);
});

it("keeps an updated book in the active Location filter without reloading", async () => {
  locationContext.locations = [{ id: 1, name: "Shelf A", parent_id: null, child_count: 0, stats: { total_books: 1 } }];
  getBooks.mockResolvedValue({ items: [{ id: 1, title: "Before", author: "Author", location_id: 1 }], total: 1 });
  updateBook.mockResolvedValue({ id: 1, title: "After", author: "Author", location_id: 1 });

  render(<LocationFilterHarness locationId={1} nextLocationId={1} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "save filtered book" }) as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { screen.getByRole("button", { name: "save filtered book" }).click(); });
  expect(screen.getByTestId("book-count").textContent).toBe("1");
  expect(screen.getByTestId("book-location").textContent).toBe("1");
  expect(getBooks).toHaveBeenCalledTimes(2);
});

it("uses the Location subtree when reconciling a filtered book", async () => {
  locationContext.locations = [{ id: 1, name: "Parent", parent_id: null, child_count: 2, stats: { total_books: 1 }, children: [{ id: 2, name: "Child A", parent_id: 1, child_count: 0, stats: { total_books: 1 } }, { id: 3, name: "Child B", parent_id: 1, child_count: 0, stats: { total_books: 0 } }] }];
  getBooks.mockResolvedValue({ items: [{ id: 1, title: "Moved", author: "Author", location_id: 2 }], total: 1 });
  updateBook.mockResolvedValue({ id: 1, title: "Moved", author: "Author", location_id: 3 });

  render(<LocationFilterHarness locationId={1} nextLocationId={3} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "save filtered book" }) as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { screen.getByRole("button", { name: "save filtered book" }).click(); });
  expect(screen.getByTestId("book-count").textContent).toBe("1");
  expect(screen.getByTestId("book-location").textContent).toBe("3");
  expect(getBooks).toHaveBeenCalledTimes(2);
});

it("removes a book moved outside the selected Location subtree", async () => {
  locationContext.locations = [{ id: 1, name: "Parent", parent_id: null, child_count: 1, stats: { total_books: 1 }, children: [{ id: 2, name: "Child", parent_id: 1, child_count: 0, stats: { total_books: 1 } }] }, { id: 4, name: "Outside", parent_id: null, child_count: 0, stats: { total_books: 0 } }];
  getBooks.mockResolvedValue({ items: [{ id: 1, title: "Moved", author: "Author", location_id: 2 }], total: 1 });
  updateBook.mockResolvedValue({ id: 1, title: "Moved", author: "Author", location_id: 4 });

  render(<LocationFilterHarness locationId={1} nextLocationId={4} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "save filtered book" }) as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { screen.getByRole("button", { name: "save filtered book" }).click(); });
  expect(screen.getByTestId("book-count").textContent).toBe("0");
  expect(getBooks).toHaveBeenCalledTimes(2);
});

it("removes an assigned book from the No Location filter without reloading", async () => {
  locationContext.locations = [{ id: 1, name: "Shelf", parent_id: null, child_count: 0, stats: { total_books: 1 } }];
  getBooks.mockResolvedValue({ items: [{ id: 1, title: "Unassigned", author: "Author", location_id: null }], total: 1 });
  updateBook.mockResolvedValue({ id: 1, title: "Unassigned", author: "Author", location_id: 1 });

  render(<LocationFilterHarness locationId={-1} nextLocationId={1} />);
  await waitFor(() => expect((screen.getByRole("button", { name: "save filtered book" }) as HTMLButtonElement).disabled).toBe(false));
  await act(async () => { screen.getByRole("button", { name: "save filtered book" }).click(); });
  expect(screen.getByTestId("book-count").textContent).toBe("0");
  expect(getBooks).toHaveBeenCalledTimes(2);
});
