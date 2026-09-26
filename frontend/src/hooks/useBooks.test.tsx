// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { useBooks } from "./useBooks";
import type { Location } from "../types/location";
import type { Category } from "../types/category";
import type { BrowseFilters } from "../utils/bookBrowse";

const getBooks = vi.hoisted(() => vi.fn());
const deleteBook = vi.hoisted(() => vi.fn());
const updateBook = vi.hoisted(() => vi.fn());
const locationContext = vi.hoisted(() => ({ locations: [] as Location[] }));
const categoryContext = vi.hoisted(() => ({ categories: [] as Category[] }));

vi.mock("../api/books", () => ({ getBooks, createBook: vi.fn(), createBookFromISBN: vi.fn(), deleteBook, updateBook }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ ready: true, token: "test-token" }) }));
vi.mock("../context/LocationContext", () => ({ useLocations: () => locationContext }));
vi.mock("../context/CategoryContext", () => ({ useCategories: () => categoryContext }));

const page = (start: number) => ({
  items: Array.from({ length: 20 }, (_, index) => ({ id: start + index, title: `Book ${start + index}`, author: "Author", location_id: 1 })),
  total: 60,
});

function Harness() {
  const { books, saveBook, removeBook, loadMoreBooks, hasMore } = useBooks();
  const laterBook = books.find((book) => book.id === 45);
  return <><div data-testid="book-count">{books.length}</div><div data-testid="later-book">{laterBook ? `${laterBook.id}:${laterBook.location_id}` : "missing"}</div>{hasMore && <button onClick={() => void loadMoreBooks()}>load more</button>}<button disabled={!laterBook} onClick={() => void saveBook({ ...laterBook!, location_id: 2 })}>save</button><button disabled={!laterBook} onClick={() => void removeBook(laterBook!.id)}>delete</button></>;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); locationContext.locations = []; categoryContext.categories = []; });

function SaveFilterHarness({ activeFilters }: { activeFilters: BrowseFilters }) {
  const { books, saveBook, updateFilters, loadMoreBooks } = useBooks();
  useEffect(() => { updateFilters(activeFilters); }, [activeFilters]);
  const first = books.find((book) => book.id === 1);
  return <><span data-testid="filtered-ids">{books.map((book) => book.id).join(",")}</span>
    <button disabled={!first} onClick={() => void saveBook(first!)}>save filtered book</button>
    <button onClick={() => void loadMoreBooks()}>more filtered books</button>
  </>;
}

function LocationFilterHarness({ locationId, nextLocationId }: { locationId: number; nextLocationId: number | null }) {
  const { books, saveBook, updateFilters } = useBooks();
  useEffect(() => { updateFilters({ locationId }); }, [locationId]);
  const book = books[0];
  return <><div data-testid="book-count">{books.length}</div><div data-testid="book-location">{book?.location_id ?? "missing"}</div><button disabled={!book} onClick={() => void saveBook({ ...book!, location_id: nextLocationId })}>save filtered book</button></>;
}

function CheckoutHarness() {
  const { books, reconcileCheckout, loadMoreBooks } = useBooks();
  const target = books.find((book) => book.id === 45);
  return <><span data-testid="checkout-count">{books.length}</span>
    <button onClick={() => void loadMoreBooks()}>more checkout books</button>
    <button disabled={!target} onClick={() => reconcileCheckout({ ...target!, is_checked_out: true })}>take out loaded</button>
    <button onClick={() => reconcileCheckout({ id: 45, title: "Book 45", author: "Author", location_id: 1, is_checked_out: false })}>return loaded</button>
  </>;
}

function StaleCheckoutHarness() {
  const { books, reconcileCheckout, loadMoreBooks } = useBooks();
  return <><span data-testid="stale-ids">{books.map((book) => book.id).join(",")}</span>
    <button onClick={() => void loadMoreBooks()}>request next page</button>
    <button onClick={() => reconcileCheckout({ id: 1, title: "Book 1", author: "Author", location_id: 1, is_checked_out: true })}>take out first</button>
  </>;
}

it("keeps the next page offset when a returned book sorts beyond loaded pages", async () => {
  function OutsideWindow() {
    const { books, reconcileCheckout, loadMoreBooks } = useBooks();
    return <><span data-testid="outside-count">{books.length}</span>
      <button onClick={() => reconcileCheckout({ id: 999, title: "Later", author: "Author Zebra", location_id: 1, is_checked_out: false })}>return later book</button>
      <button onClick={() => void loadMoreBooks()}>more later books</button></>;
  }
  getBooks.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(21));
  render(<OutsideWindow />);
  await waitFor(() => expect(screen.getByTestId("outside-count").textContent).toBe("20"));
  await act(async () => { screen.getByRole("button", { name: "return later book" }).click(); });
  expect(screen.getByTestId("outside-count").textContent).toBe("20");
  await act(async () => { screen.getByRole("button", { name: "more later books" }).click(); });
  expect(getBooks).toHaveBeenLastCalledWith(20, 20, "", null, null, undefined);
});

it("ignores a page response started before a checkout transition", async () => {
  let resolvePage!: (value: ReturnType<typeof page>) => void;
  getBooks.mockResolvedValueOnce(page(1)).mockImplementationOnce(() => new Promise((resolve) => { resolvePage = resolve; }));
  render(<StaleCheckoutHarness />);
  await waitFor(() => expect(screen.getByTestId("stale-ids").textContent).toContain("1"));
  await act(async () => { screen.getByRole("button", { name: "request next page" }).click(); });
  await act(async () => { screen.getByRole("button", { name: "take out first" }).click(); });
  await act(async () => { resolvePage({ items: [{ id: 1, title: "Book 1", author: "Author", location_id: 1 }], total: 60 }); });
  expect(screen.getByTestId("stale-ids").textContent?.split(",")).not.toContain("1");
});

it("reconciles checkout across loaded pages without a reset and adjusts the next offset", async () => {
  getBooks.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(21)).mockResolvedValueOnce(page(41));
  render(<CheckoutHarness />);
  await waitFor(() => expect(screen.getByTestId("checkout-count").textContent).toBe("20"));
  await act(async () => { screen.getByRole("button", { name: "more checkout books" }).click(); });
  await act(async () => { screen.getByRole("button", { name: "more checkout books" }).click(); });
  expect(screen.getByTestId("checkout-count").textContent).toBe("60");
  await act(async () => { screen.getByRole("button", { name: "take out loaded" }).click(); });
  expect(screen.getByTestId("checkout-count").textContent).toBe("59");
  expect(getBooks).toHaveBeenCalledTimes(3);
  await act(async () => { screen.getByRole("button", { name: "return loaded" }).click(); });
  expect(screen.getByTestId("checkout-count").textContent).toBe("60");
  expect(getBooks).toHaveBeenCalledTimes(3);
});

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

it.each([
  ["search", { search: "Needle" }, { title: "Changed title" }],
  ["category", { categoryId: 1 }, { category_id: 2 }],
  ["read", { read: false }, { read: true }],
] as const)("removes a saved book that leaves the active %s filter and keeps the next offset", async (_name, activeFilters, changes) => {
  categoryContext.categories = [
    { id: 1, name: "One", parent_id: null, child_count: 0, stats: { total_books: 1, read_books: 0, unread_books: 1 } },
    { id: 2, name: "Two", parent_id: null, child_count: 0, stats: { total_books: 0, read_books: 0, unread_books: 0 } },
  ];
  const items = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, title: `Needle ${index + 1}`, author: `Author ${index + 1}`, category_id: 1, read: false, location_id: 1 }));
  getBooks.mockResolvedValue({ items, total: 40 });
  updateBook.mockResolvedValue({ ...items[0], ...changes });
  render(<SaveFilterHarness activeFilters={activeFilters} />);
  await waitFor(() => expect(screen.getByTestId("filtered-ids").textContent?.split(",")).toHaveLength(20));
  await act(async () => { screen.getByRole("button", { name: "save filtered book" }).click(); });
  expect(screen.getByTestId("filtered-ids").textContent?.split(",")).not.toContain("1");
  await act(async () => { screen.getByRole("button", { name: "more filtered books" }).click(); });
  const expectedFilters: BrowseFilters = activeFilters;
  expect(getBooks).toHaveBeenLastCalledWith(19, 20, expectedFilters.search ?? "", null, expectedFilters.categoryId ?? null, expectedFilters.read);
});

it("removes a saved book that sorts beyond the loaded page and keeps pagination", async () => {
  const items = page(1).items;
  getBooks.mockResolvedValue({ items, total: 40 });
  updateBook.mockResolvedValue({ ...items[0], author: "Author Zulu" });
  render(<SaveFilterHarness activeFilters={{}} />);
  await waitFor(() => expect(screen.getByTestId("filtered-ids").textContent?.split(",")).toHaveLength(20));
  await act(async () => { screen.getByRole("button", { name: "save filtered book" }).click(); });
  expect(screen.getByTestId("filtered-ids").textContent?.split(",")).not.toContain("1");
  await act(async () => { screen.getByRole("button", { name: "more filtered books" }).click(); });
  expect(getBooks).toHaveBeenLastCalledWith(19, 20, "", null, null, undefined);
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
