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
import type { Location } from "../types/location";
import type { Category } from "../types/category";

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

type Filters = {
  search?: string;

  locationId?: number | null;

  categoryId?: number | null;

  read?: boolean | null;
};

const LIMIT = 20;

function categoryMatchesFilter(book: Book, categoryId: number | null | undefined, categories: Category[]) {
  if (categoryId == null) return true;
  if (categoryId === -1) return book.category_id == null;
  if (book.category_id === categoryId) return true;
  const byId = new Map<number, Category>();
  const visit = (nodes: Category[]) => nodes.forEach((node) => { byId.set(node.id, node); visit(node.children ?? []); });
  visit(categories);
  let current = book.category_id == null ? undefined : byId.get(book.category_id);
  while (current?.parent_id != null) {
    if (current.parent_id === categoryId) return true;
    current = byId.get(current.parent_id);
  }
  return false;
}

function locationMatchesFilter(
  book: Book,
  locationId: number | null | undefined,
  locations: Location[],
) {
  if (locationId === null || locationId === undefined) return true;
  if (locationId === -1) return book.location_id == null;
  if (book.location_id == null) return false;
  if (book.location_id === locationId) return true;

  const locationById = new Map<number, Location>();
  const addLocations = (nodes: Location[]) => {
    nodes.forEach((location) => {
      locationById.set(location.id, location);
      if (location.children?.length) addLocations(location.children);
    });
  };
  addLocations(locations);

  let current = locationById.get(book.location_id);
  while (current?.parent_id != null) {
    if (current.parent_id === locationId) return true;
    current = locationById.get(current.parent_id);
  }
  return false;
}

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);

  const [skip, setSkip] = useState(0);

  const [hasMore, setHasMore] = useState(true);

  const [isLoading, setIsLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Filters>({
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
    setBooks((prev) => prev.flatMap((item) => {
      if (item.id !== updated.id) return [item];
      return locationMatchesFilter(updated, filters.locationId, locations) ? [updated] : [];
    }));

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
    const matches = locationMatchesFilter(updated, filters.locationId, locations)
      && categoryMatchesFilter(updated, filters.categoryId, categories)
      && (filters.read == null || Boolean(updated.read) === filters.read)
      && (!filters.search || updated.title.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()) || updated.author.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()));
    const exists = books.some((book) => book.id === updated.id);
    const surnameKey = (book: Book) => book.author.split(" ").at(-1) ?? "";
    const lastLoaded = books.at(-1);
    const fitsLoadedWindow = !hasMore || !lastLoaded
      || surnameKey(updated).localeCompare(surnameKey(lastLoaded)) < 0
      || (surnameKey(updated) === surnameKey(lastLoaded) && updated.id <= lastLoaded.id);
    const insert = !updated.is_checked_out && matches && (exists || fitsLoadedWindow);
    if (exists && (updated.is_checked_out || !matches)) setSkip((value) => Math.max(0, value - 1));
    else if (!exists && insert) setSkip((value) => value + 1);
    setBooks((current) => {
      if (updated.is_checked_out || !matches) {
        return current.filter((book) => book.id !== updated.id);
      }
      if (!insert) return current;
      const next = [...current.filter((book) => book.id !== updated.id), updated];
      return next.sort((a, b) => surnameKey(a).localeCompare(surnameKey(b)) || a.id - b.id);
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
