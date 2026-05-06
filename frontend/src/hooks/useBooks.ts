import { useState, useEffect, useRef } from "react";

import {
  getBooks,
  createBook,
  createBookFromISBN,
  deleteBook,
  updateBook,
} from "../api/books";

import { useAuth } from "../context/AuthContext";

import type { Book } from "../types/book";

type BookCreateInput = {
  title: string;
  author: string;

  year?: number;
  isbn?: string;
  description?: string;
  read?: boolean;

  location_id?: number | null;
  cover_url?: string;

  // ✅ single category
  category_id?: number | null;
};

type Filters = {
  search?: string;
  locationId?: number | null;
  categoryId?: number | null;
};

const LIMIT = 20;

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    search: "",
    locationId: null,
    categoryId: null,
  });

  const requestIdRef = useRef(0);

  const { ready, token } = useAuth();

  function notifyStatsUpdate() {
    window.dispatchEvent(new Event("stats-updated"));
  }

  // -------------------
  // 📥 LOAD BOOKS
  // -------------------

  async function loadBooks(reset = true) {
    const requestId = ++requestIdRef.current;
    const newSkip = reset ? 0 : skip;

    setIsLoading(true);

    const data = await getBooks(
      newSkip,
      LIMIT,
      filters.search,
      filters.locationId,
      filters.categoryId,
    );

    if (requestId !== requestIdRef.current) return;

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
    setIsLoading(false);
  }

  async function loadMoreBooks() {
    if (!hasMore || isLoading) return;
    await loadBooks(false);
  }

  // -------------------
  // 🔍 FILTER STATE
  // -------------------

  function updateFilters(newFilters: Partial<Filters>) {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }

  // -------------------
  // ✅ LOAD ON CHANGE
  // -------------------

  useEffect(() => {
    if (!ready || !token) return;
    loadBooks(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, ready, token]);

  // -------------------
  // ➕ ADD BOOK
  // -------------------

  async function addBook(book: BookCreateInput) {
    const data = await createBook({
      ...book,
      location_id: book.location_id ?? null,
      category_id: book.category_id ?? null,
    });

    await loadBooks(true);
    notifyStatsUpdate();

    return data;
  }

  async function addBookFromISBN(book: BookCreateInput) {
    const data = await createBookFromISBN({
      ...book,
      location_id: book.location_id ?? null,
      category_id: book.category_id ?? null,
    });

    await loadBooks(true);
    notifyStatsUpdate();

    if ((data as any)._warning) {
      console.warn((data as any)._warning);
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
    const updated = await updateBook(book.id, {
      title: book.title,
      author: book.author,
      year: book.year,
      isbn: book.isbn,
      description: book.description,
      read: book.read,
      location_id: book.location_id,
      cover_url: book.cover_url,
      category_id: book.category_id ?? null,
    });

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
    isLoading,
  };
}
