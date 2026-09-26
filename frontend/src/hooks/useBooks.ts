import { useState, useEffect, useRef } from "react";

import {
  getBooks,
  createBook,
  createBookFromISBN,
  deleteBook,
  updateBook,
} from "../api/books";

import { useAuth } from "../context/AuthContext";
import { useLocations } from "../context/LocationContext";
import { useCategories } from "../context/CategoryContext";

import type { Book } from "../types/book";
import type { ReviewIntent } from "../api/books";

import type { ProviderResult } from "../types/provider";
import { authorSurname, bookMatchesFilters, compareBookSurnames, type BrowseFilters } from "../utils/bookBrowse";

type BookCreateInput = {
  title: string;

  author: string;

  subtitle?: string;

  publisher?: string;

  language?: string;

  page_count?: number;

  year?: number;

  isbn?: string;

  description?: string;

  read?: boolean;

  location_id?: number | null;

  cover_url?: string;

  // ✅ single category
  category_id?: number | null;
};

const LIMIT = 20;

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);

  const [skip, setSkip] = useState(0);

  const [hasMore, setHasMore] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<BrowseFilters>({
    search: "",
    locationId: null,
    categoryId: null,
  });

  const requestIdRef = useRef(0);

  const { ready, token } = useAuth();
  const { locations } = useLocations();
  const { categories } = useCategories();

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
    setLoadError(null);

    try {
      const data = await getBooks(
        newSkip,
        LIMIT,
        filters.search,
        filters.locationId,
        filters.categoryId,
        filters.read ?? undefined,
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
    } catch (err) {
      if (requestId === requestIdRef.current) {
        console.error("Failed to load books", err);
        setLoadError("Books could not be loaded");
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }

  async function loadMoreBooks() {
    if (!hasMore || isLoading) return;

    await loadBooks(false);
  }

  // -------------------
  // 🔍 FILTER STATE
  // -------------------

  function updateFilters(newFilters: Partial<BrowseFilters>) {
    setFilters((prev) => ({
      ...prev,
      ...newFilters,
    }));
  }

  // -------------------
  // ✅ LOAD ON CHANGE
  // -------------------

  useEffect(() => {
    if (!ready || !token) {
      requestIdRef.current += 1;
      setIsLoading(false);
      setLoadError(null);
      return;
    }

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

  async function addBookFromISBN(payload: {
    book: BookCreateInput;

    provider_results: ProviderResult[];

    allow_duplicate?: boolean;
  }) {
    const data = await createBookFromISBN({
      book: {
        ...payload.book,

        location_id: payload.book.location_id ?? null,

        category_id: payload.book.category_id ?? null,
      },

      provider_results: payload.provider_results,

      allow_duplicate: payload.allow_duplicate,
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

    requestIdRef.current += 1;
    setIsLoading(false);
    if (books.some((book) => book.id === id)) setSkip((value) => Math.max(0, value - 1));

    setBooks((prev) => prev.filter((b) => b.id !== id));

    notifyStatsUpdate();
  }

  // -------------------
  // 💾 SAVE
  // -------------------

  async function saveBook(book: Book, reviewIntent: ReviewIntent = {}) {
    const updated = await updateBook(book.id, {
      title: book.title,

      author: book.author,

      subtitle: book.subtitle,

      publisher: book.publisher,

      language: book.language,

      page_count: book.page_count,

      year: book.year,

      isbn: book.isbn,

      description: book.description,

      read: book.read,

      location_id: book.location_id,

      cover_url: book.cover_url,

      category_id: book.category_id ?? null,

      ...reviewIntent,
    });

    // The update response is authoritative for this book. Merge it into the
    // currently loaded pages instead of resetting infinite-scroll pagination.
    requestIdRef.current += 1;
    setIsLoading(false);
    const matches = !updated.is_checked_out && bookMatchesFilters(updated, filters, locations, categories);
    const lastLoaded = books.at(-1);
    const keepInLoadedWindow = matches && (!hasMore || !lastLoaded || compareBookSurnames(updated, lastLoaded) <= 0);
    if (!keepInLoadedWindow && books.some((item) => item.id === updated.id)) setSkip((value) => Math.max(0, value - 1));
    setBooks((prev) => prev.flatMap((item) => item.id === updated.id ? keepInLoadedWindow ? [updated] : [] : [item])
      .sort(compareBookSurnames));

    notifyStatsUpdate();

    return updated;
  }

  // -------------------
  // 🔄 UPDATE IN MEMORY
  // -------------------

  function updateBookInState(updatedBook: Book) {
    setBooks((prev) =>
      prev.map((book) => (book.id === updatedBook.id ? updatedBook : book)),
    );
  }

  function reconcileCheckout(updated: Book) {
    // Invalidate a page requested before the physical-presence transition.
    requestIdRef.current += 1;
    setIsLoading(false);
    const matches = bookMatchesFilters(updated, filters, locations, categories);
    const exists = books.some((book) => book.id === updated.id);
    const lastLoaded = books.at(-1);
    const fitsLoadedWindow = !hasMore || !lastLoaded
      || authorSurname(updated.author).localeCompare(authorSurname(lastLoaded.author)) < 0
      || (authorSurname(updated.author) === authorSurname(lastLoaded.author) && updated.id <= lastLoaded.id);
    const insert = !updated.is_checked_out && matches && (exists || fitsLoadedWindow);
    if (exists && (updated.is_checked_out || !matches)) setSkip((value) => Math.max(0, value - 1));
    else if (!exists && insert) setSkip((value) => value + 1);
    setBooks((current) => {
      if (updated.is_checked_out || !matches) {
        return current.filter((book) => book.id !== updated.id);
      }
      if (!insert) return current;
      const next = [...current.filter((book) => book.id !== updated.id), updated];
      return next.sort(compareBookSurnames);
    });
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
    updateBookInState,
    reconcileCheckout,
    updateFilters,
    filters,
    isLoading,
    loadError,
  };
}
