import { useState, useEffect } from "react";
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
  _warning?: string;
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

type Filters = {
  search?: string;
  locationId?: number | null;
};

const LIMIT = 20;

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    locationId: null,
  });

  function notifyStatsUpdate() {
    window.dispatchEvent(new Event("stats-updated"));
  }

  // -------------------
  // 📥 LOAD BOOKS
  // -------------------
  async function loadBooks(reset = true) {
    const currentSkip = reset ? 0 : skip;

    const data = await getBooks(
      currentSkip,
      LIMIT,
      filters.search,
      filters.locationId,
    );

    if (reset) {
      setBooks(data.items);
      setSkip(LIMIT);
    } else {
      setBooks((prev) => [...prev, ...data.items]);
      setSkip((prev) => prev + LIMIT);
    }

    setHasMore(currentSkip + LIMIT < data.total);
  }

  async function loadMoreBooks() {
    if (!hasMore) return;
    await loadBooks(false);
  }

  // -------------------
  // 🔍 SET FILTERS
  // -------------------
  function updateFilters(newFilters: Partial<Filters>) {
    const updated = { ...filters, ...newFilters };

    setFilters(updated);

    // ✅ reset state ONLY (no fetch here)
    setBooks([]);
    setSkip(0);
    setHasMore(true);
  }

  // -------------------
  // 🔥 CRITICAL FIX
  // -------------------
  useEffect(() => {
    loadBooks(true);
  }, [filters]);

  // -------------------
  // ➕ ADD BOOK
  // -------------------
  async function addBook(book: BookCreateInput) {
    const data = await createBook(book);

    setBooks((prev) => [data, ...prev]);
    notifyStatsUpdate();

    return data;
  }

  // -------------------
  // ➕ ADD FROM ISBN
  // -------------------
  async function addBookFromISBN(book: BookCreateInput) {
    const data = await createBookFromISBN(book);

    setBooks((prev) => [data, ...prev]);
    notifyStatsUpdate();

    if (data._warning) {
      console.warn(data._warning);
    }

    return data;
  }

  // -------------------
  // ❌ DELETE
  // -------------------
  async function removeBook(id: number) {
    await deleteBook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    notifyStatsUpdate();
  }

  // -------------------
  // 💾 SAVE
  // -------------------
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
    addBookFromISBN,
    removeBook,
    saveBook,
    updateFilters,
    filters,
  };
}
