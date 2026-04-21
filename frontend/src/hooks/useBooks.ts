import { useState } from "react";
import {
  getBooks,
  createBook,
  createBookFromISBN,
  deleteBook,
  updateBook,
} from "../api/books";

type Category = {
  id: number;
  name: string;
};

type Book = {
  id: number;
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  description?: string;
  read?: boolean;
  location_id?: number;
  cover_url?: string;
  categories?: Category[];
  category_ids?: number[];
  date_added?: string;
  _warning?: string; // ✅ NEW
};

type BookCreateInput = {
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  description?: string;
  read?: boolean;
  location_id?: number | null;
  cover_url?: string;
  category_ids?: number[];
};

const LIMIT = 20;

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  function notifyStatsUpdate() {
    window.dispatchEvent(new Event("stats-updated"));
  }

  async function loadBooks() {
    const data = await getBooks(0, LIMIT);

    setBooks(data.items);
    setSkip(LIMIT);
    setHasMore(data.items.length < data.total);
  }

  async function loadMoreBooks() {
    if (!hasMore) return;

    const data = await getBooks(skip, LIMIT);

    const nextSkip = skip + LIMIT;

    setBooks((prev) => [...prev, ...data.items]);
    setSkip(nextSkip);
    setHasMore(nextSkip < data.total);
  }

  async function addBook(book: BookCreateInput) {
    const data = await createBook(book);

    setBooks((prev) => [data, ...prev]);
    notifyStatsUpdate();

    return data;
  }

  // ✅ NEW — add via ISBN (backend-driven)
  async function addBookFromISBN(book: BookCreateInput) {
    const data = await createBookFromISBN(book);

    setBooks((prev) => [data, ...prev]);
    notifyStatsUpdate();

    if (data._warning) {
      console.warn(data._warning);
    }

    return data;
  }

  async function removeBook(id: number) {
    await deleteBook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    notifyStatsUpdate();
  }

  async function saveBook(book: Book) {
    const updated = await updateBook(book.id, book);

    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    notifyStatsUpdate();

    return updated;
  }

  return {
    books,
    loadBooks,
    loadMoreBooks,
    hasMore,
    addBook,
    addBookFromISBN, // ✅ NEW
    removeBook,
    saveBook,
  };
}
