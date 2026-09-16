// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBooks } from "./useBooks";

const getBooks = vi.hoisted(() => vi.fn());
const updateBook = vi.hoisted(() => vi.fn());

vi.mock("../api/books", () => ({ getBooks, createBook: vi.fn(), createBookFromISBN: vi.fn(), deleteBook: vi.fn(), updateBook }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ ready: true, token: "test-token" }) }));

const page = (start: number) => ({
  items: Array.from({ length: 20 }, (_, index) => ({ id: start + index, title: `Book ${start + index}`, author: "Author", location_id: 1 })),
  total: 60,
});

function Harness() {
  const { books, saveBook, loadMoreBooks, hasMore } = useBooks();
  const laterBook = books.find((book) => book.id === 45);
  return <><div data-testid="book-count">{books.length}</div><div data-testid="later-book">{laterBook ? `${laterBook.id}:${laterBook.location_id}` : "missing"}</div>{hasMore && <button onClick={() => void loadMoreBooks()}>load more</button>}<button disabled={!laterBook} onClick={() => void saveBook({ ...laterBook!, location_id: 2 })}>save</button></>;
}

afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
