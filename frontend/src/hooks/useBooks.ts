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
    const newSkip = reset ? 0 : skip;

    const data = await getBooks(
      newSkip,
      LIMIT,
      filters.search,
      filters.locationId,
    );

    if (reset) {
      setBooks(data.items);
      setSkip(LIMIT);
    } else {
      setBooks((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const newItems = data.items.filter((b) => !existingIds.has(b.id));
        return [...prev, ...newItems];
      });

      setSkip(newSkip + LIMIT);
    }

    setHasMore(newSkip + LIMIT < data.total);
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

    setBooks([]);
    setSkip(0);
    setHasMore(true);
  }

  useEffect(() => {
    loadBooks(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // -------------------
  // ➕ ADD BOOK (FIXED)
  // -------------------
  async function addBook(book: BookCreateInput) {
    const data = await createBook(book);

    // ✅ reload instead of inserting
    await loadBooks(true);

    notifyStatsUpdate();
    return data;
  }

  // -------------------
  // ➕ ADD FROM ISBN (FIXED)
  // -------------------
  async function addBookFromISBN(book: BookCreateInput) {
    const data = await createBookFromISBN(book);

    // ✅ reload instead of inserting
    await loadBooks(true);

    notifyStatsUpdate();

    if (data._warning) {
      console.warn(data._warning);
    }

    return data;
  }

  // -------------------
  // ❌ DELETE (IMPROVED)
  // -------------------
  async function removeBook(id: number) {
    await deleteBook(id);

    // keep UI responsive + consistent
    setBooks((prev) => prev.filter((b) => b.id !== id));

    notifyStatsUpdate();
  }

  // -------------------
  // 💾 SAVE (IMPROVED)
  // -------------------
  async function saveBook(book: Book) {
    const updated = await updateBook(book.id, book);

    // ⚠️ if sorting field changed → reload
    await loadBooks(true);

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
