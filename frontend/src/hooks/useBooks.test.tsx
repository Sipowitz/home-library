// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useBooks } from "./useBooks";

const getBooks = vi.hoisted(() => vi.fn());
const updateBook = vi.hoisted(() => vi.fn());

vi.mock("../api/books", () => ({
  getBooks,
  createBook: vi.fn(),
  createBookFromISBN: vi.fn(),
  deleteBook: vi.fn(),
  updateBook,
}));
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ ready: true, token: "test-token" }),
}));

function Harness() {
  const { books, saveBook } = useBooks();
  return (
    <>
      <div data-testid="books">{books.map((book) => `${book.id}:${book.location_id}`).join(",")}</div>
      <button onClick={() => void saveBook({ ...books[0], location_id: 2 })}>save</button>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("updates the saved book without clearing the grid while refetch is pending", async () => {
  const first = { id: 1, title: "One", author: "A", location_id: 1 };
  const second = { id: 2, title: "Two", author: "B", location_id: 1 };
  let resolveRefresh!: (value: { items: typeof first[]; total: number }) => void;
  getBooks.mockImplementationOnce(() => Promise.resolve({ items: [first, second], total: 2 }))
    .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve; }));
  const updated = { ...first, location_id: 2 };
  updateBook.mockResolvedValue(updated);

  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("books").textContent).toBe("1:1,2:1"));

  await act(async () => { screen.getByRole("button", { name: "save" }).click(); });
  expect(screen.getByTestId("books").textContent).toBe("1:2,2:1");

  await act(async () => { resolveRefresh({ items: [updated, second], total: 2 }); });
  expect(screen.getByTestId("books").textContent).toBe("1:2,2:1");
});
