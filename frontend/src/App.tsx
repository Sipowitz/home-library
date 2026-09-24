import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { login as loginApi } from "./api/auth";

import { useBooks } from "./hooks/useBooks";
import { useLocations } from "./context/LocationContext";
import { useCategories } from "./context/CategoryContext";
import { useAuth } from "./context/AuthContext";
import { useSearch } from "./hooks/useSearch";
import { useBookActions } from "./hooks/useBookActions";
import { usePreferences } from "./hooks/usePreferences";

import { BookGridView } from "./components/books/views/BookGridView";
import { BookListView } from "./components/books/views/BookListView";
import { ViewModeSwitcher } from "./components/books/views/ViewModeSwitcher";

import { SettingsModal } from "./components/settings/SettingsModal";
import { BookPanel } from "./components/books/BookPanel";
import { MaintenanceReviewSession } from "./components/settings/maintenance/MaintenanceReviewSession";

import { SearchBar } from "./components/search/SearchBar";
import { TopPanels } from "./components/layout/TopPanels";
import { Header } from "./components/layout/Header";
import { ActionButton } from "./components/ui/ActionButton";
import { AddBookDialog } from "./components/books/AddBookDialog";
import { CheckLibraryDialog } from "./components/books/CheckLibraryDialog";

import toast from "react-hot-toast";

import type { Book, BookDraft } from "./types/book";
import type { LibraryViewMode } from "./types/preferences";
import { getBook, getOutOfLibrary, takeOutBook, getReturnPreview, confirmReturnBook, type ReturnPlacementPreview } from "./api/books";
import { getGroupedBooks, type GroupedBooksResponse, type SuggestedBook, type SuggestedLocation } from "./api/books";
import { GroupedLocationBooks } from "./components/books/views/GroupedLocationBooks";
import { SuggestedLocationAssignmentDialog } from "./components/books/SuggestedLocationAssignmentDialog";
import { ReturnToShelfDialog } from "./components/books/ReturnToShelfDialog";
import { OutOfLibrary } from "./components/books/OutOfLibrary";
import type { ReviewTarget } from "./components/settings/maintenance/MaintenanceSettings";
import type { ReviewIntent } from "./api/books";
import { browseCollection, browseRootCollections, type CollectionBrowseBook, type CollectionBrowseResult } from "./api/collections";
import type { Series } from "./types/series";

/**
 * The collection browser is a separate, retained projection of books. Keep its
 * loaded pages authoritative after an edit without changing their membership,
 * order, or pagination.
 */
export function reconcileCollectionBrowseBook(
  browse: CollectionBrowseResult,
  updatedBook: Book,
): CollectionBrowseResult {
  const reconcileBook = (book: CollectionBrowseBook): CollectionBrowseBook => (
    book.id === updatedBook.id ? { ...book, ...updatedBook } : book
  );

  return {
    ...browse,
    books: browse.books.map(reconcileBook),
    items: browse.items.map((item) => (
      item.kind === "book" && item.book.id === updatedBook.id
        ? { ...item, book: reconcileBook(item.book) }
        : item
    )),
  };
}

export default function App() {
  const {
    books,
    loadMoreBooks,
    hasMore,
    addBook,
    addBookFromISBN,
    removeBook,
    saveBook,
    reconcileCheckout,
    updateFilters,
    isLoading,
    loadError,
    filters,
  } = useBooks();

  const { locations } = useLocations();

  const { categories } = useCategories();

  const { isAuthenticated, login, logout } = useAuth();

  const { preferences, updatePreferences } = usePreferences();

  const libraryName = preferences?.library_name?.trim() || "My Library";

  useEffect(() => {
    document.title = libraryName;
  }, [libraryName]);

  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);

  const { searchInput, setSearchInput } = useSearch({
    isAuthenticated,
    updateFilters,
  });

  const [username, setUsername] = useState("");

  const [password, setPassword] = useState("");

  const [newBook, setNewBook] = useState<BookDraft>({});

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedBookOpenedInCollection, setSelectedBookOpenedInCollection] = useState(false);
  const [outBooks, setOutBooks] = useState<Book[]>([]);
  const [outRevision, setOutRevision] = useState(0);
  const [returnPreview, setReturnPreview] = useState<ReturnPlacementPreview | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);

  const [editing, setEditing] = useState(false);

  const [editData, setEditData] = useState<Book | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showAddBook, setShowAddBook] = useState(false);
  const [showCheckLibrary, setShowCheckLibrary] = useState(false);
  const [reviewSession, setReviewSession] = useState<{
    book: Book;
    target: ReviewTarget;
    guided: boolean;
    followUp: ReviewTarget | null;
    origin: "maintenance_direct" | "maintenance_guided" | "add_review";
  } | null>(null);
  const [reviewSaved, setReviewSaved] = useState<{ bookId: number; nonce: number; guided?: boolean } | null>(null);
  const [evidenceRefreshVersion, setEvidenceRefreshVersion] = useState(0);
  const [collectionPath, setCollectionPath] = useState<Series[]>([]);
  const [collectionBrowse, setCollectionBrowse] = useState<CollectionBrowseResult | null>(null);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionPageLoading, setCollectionPageLoading] = useState(false);
  const [collectionHasMore, setCollectionHasMore] = useState(false);
  const [collectionRevision, setCollectionRevision] = useState(0);
  const [collectionSort, setCollectionSort] = useState<"reading" | "publication" | "chronological" | "alphabetical">("reading");
  const [groupByLocation, setGroupByLocation] = useState(false);
  const [groupedBooks, setGroupedBooks] = useState<GroupedBooksResponse | null>(null);
  const [groupedLoading, setGroupedLoading] = useState(false);
  const [groupedError, setGroupedError] = useState<string | null>(null);
  const [groupedRevision, setGroupedRevision] = useState(0);
  const [suggestedAssignment, setSuggestedAssignment] = useState<{ book: SuggestedBook; location: SuggestedLocation | null } | null>(null);
  const [assigningSuggestedLocation, setAssigningSuggestedLocation] = useState(false);

  const [isScrolling, setIsScrolling] = useState(false);
  const [isSearchPanelPastThreshold, setIsSearchPanelPastThreshold] =
    useState(false);

  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const searchPanelFlowAnchorRef = useRef<HTMLDivElement | null>(null);
  const searchPanelStickyOffsetRef = useRef(0);
  const collectionBrowseKeyRef = useRef<string | null>(null);
  const collectionRequestGenerationRef = useRef(0);
  const collectionPageRequestGenerationRef = useRef(0);
  const bookOpenRequestGenerationRef = useRef(0);
  const rootCollectionSnapshotRef = useRef<{ browse: CollectionBrowseResult; hasMore: boolean; key: string; scrollY: number } | null>(null);
  const pendingRootScrollRestoreRef = useRef<number | null>(null);
  const groupedRequestGenerationRef = useRef(0);
  const outRequestGenerationRef = useRef(0);

  const refreshGroupedBooks = useCallback(() => {
    setGroupedRevision((revision) => revision + 1);
  }, []);

  const reconcileDeletedBook = useCallback((bookId: number) => {
    const withoutBook = (browse: CollectionBrowseResult): CollectionBrowseResult => ({
      ...browse,
      items: (browse.items ?? []).filter((item) => item.kind !== "book" || item.book.id !== bookId),
      books: (browse.books ?? []).filter((book) => book.id !== bookId),
    });

    setCollectionBrowse((current) => current ? withoutBook(current) : current);

    const snapshot = rootCollectionSnapshotRef.current;
    if (snapshot) {
      rootCollectionSnapshotRef.current = {
        ...snapshot,
        browse: withoutBook(snapshot.browse),
      };
    }
  }, []);

  const reconcileSavedBook = useCallback((updatedBook: Book) => {
    setCollectionBrowse((current) => (
      current ? reconcileCollectionBrowseBook(current, updatedBook) : current
    ));

    const snapshot = rootCollectionSnapshotRef.current;
    if (snapshot) {
      rootCollectionSnapshotRef.current = {
        ...snapshot,
        browse: reconcileCollectionBrowseBook(snapshot.browse, updatedBook),
      };
    }
  }, []);

  const {
    isFetching,
    draftOrigin,
    handleSearch,
    handleCatalogCandidateSelected,
    handleAddBook,
    handleQuickAdd,
    handleAddAndReview,
    handleDelete,
    handleSave,
    resetAddBook,
    handleAddBookISBNChange,
  } =
    useBookActions({
      newBook,
      setNewBook,
      addBook,
      addBookFromISBN,
      removeBook,
      saveBook,
      setSelectedBook,
      setEditData,
      setEditing,
      editData,
      reconcileDeletedBook,
      reconcileSavedBook,
      reconcileGroupedBooks: refreshGroupedBooks,
    });

  const cancelPendingBookOpen = useCallback(() => {
    bookOpenRequestGenerationRef.current += 1;
  }, []);

  const openBook = useCallback(async (bookOrId: Pick<Book, "id"> | number, openedInCollection = false) => {
    const bookId = typeof bookOrId === "number" ? bookOrId : bookOrId.id;
    const generation = ++bookOpenRequestGenerationRef.current;

    try {
      const book = await getBook(bookId);
      if (generation !== bookOpenRequestGenerationRef.current) return;

      setSelectedBook(book);
      setSelectedBookOpenedInCollection(openedInCollection);
      setEditing(false);
    } catch (error) {
      if (generation !== bookOpenRequestGenerationRef.current) return;
      console.error("Book could not be opened", error);
      toast.error("Book could not be opened");
    }
  }, []);

  const confirmSuggestedLocationAssignment = useCallback(async () => {
    if (!suggestedAssignment?.location || assigningSuggestedLocation) return;
    setAssigningSuggestedLocation(true);
    try {
      await saveBook({ ...suggestedAssignment.book, location_id: suggestedAssignment.location.id });
      setSuggestedAssignment(null);
      refreshGroupedBooks();
      toast.success(`Assigned to ${suggestedAssignment.location.name}`);
    } catch (error) {
      console.error("Failed to assign suggested Location", error);
      toast.error(`Could not assign to ${suggestedAssignment.location.name}`);
    } finally {
      setAssigningSuggestedLocation(false);
    }
  }, [assigningSuggestedLocation, refreshGroupedBooks, saveBook, suggestedAssignment]);

  async function handleAddAndReviewFlow(allowDuplicate = false) {
    const created = await handleAddAndReview(allowDuplicate);
    if (!created) return;
    const metadataNeedsReview = created.metadata_review?.state !== "current";
    const coversNeedReview = created.cover_review?.state !== "current";
    if (!metadataNeedsReview && !coversNeedReview) {
      resetAddBook();
      toast.success("Book added to library");
      return;
    }
    setReviewSession({
      book: created,
      target: metadataNeedsReview ? "metadata" : "covers",
      guided: metadataNeedsReview && coversNeedReview,
      followUp: metadataNeedsReview && coversNeedReview ? "covers" : null,
      origin: "add_review",
    });
  }

  async function handlePrimaryAdd(allowDuplicate = false) {
    if (newBook.isbn?.trim() && draftOrigin !== "catalog-search") {
      await handleQuickAdd(allowDuplicate);
    } else {
      await handleAddBook();
      setShowAddBook(false);
    }
  }

  function closeAddBook() {
    resetAddBook();
    setShowAddBook(false);
  }

  // ================= VIEW MODE =================

  const viewMode: LibraryViewMode = preferences?.library_view_mode ?? "grid";

  const showCoversInList = preferences?.show_covers_in_list ?? true;
  const showCollections = preferences?.show_collections_in_library ?? false;
  const rootCollectionMode = preferences?.root_collection_display_mode ?? "collections_only";
  const currentCollection = collectionPath.at(-1) ?? null;

  useEffect(() => {
    const generation = ++outRequestGenerationRef.current;
    if (!isAuthenticated) { setOutBooks([]); return; }
    void getOutOfLibrary({ search: filters.search, categoryId: filters.categoryId,
      locationId: filters.locationId, read: filters.read,
      collectionId: groupByLocation ? null : currentCollection?.id ?? null,
    }).then((items) => {
      if (generation === outRequestGenerationRef.current) setOutBooks(items);
    }).catch((error) => {
      if (generation === outRequestGenerationRef.current) console.error("Failed to load out books", error);
    });
    return () => { outRequestGenerationRef.current += 1; };
  }, [filters.search, filters.categoryId, filters.locationId, filters.read, currentCollection?.id, groupByLocation, outRevision, isAuthenticated]);

  async function reconcileCheckoutAction(updated: Book) {
    reconcileCheckout?.(updated);
    setSelectedBook(updated);
    setEditData(updated);
    outRequestGenerationRef.current += 1;
    setOutBooks((items) => updated.is_checked_out
      ? items.some((item) => item.id === updated.id) ? items.map((item) => item.id === updated.id ? updated : item) : [...items, updated]
      : items.filter((item) => item.id !== updated.id));
    setOutRevision((value) => value + 1);
    refreshGroupedBooks();
    rootCollectionSnapshotRef.current = null;
    if (!groupByLocation && showCollections && viewMode === "grid") {
      const generation = ++collectionRequestGenerationRef.current;
      collectionPageRequestGenerationRef.current += 1;
      const desiredCount = Math.max(100, currentCollection ? collectionBrowse?.books.length ?? 0 : collectionBrowse?.items.length ?? 0);
      const requestPage = (skip: number) => currentCollection
        ? browseCollection(currentCollection.id, { ...collectionOptions(collectionPath), skip, limit: 100 })
        : browseRootCollections({ ...collectionOptions(collectionPath), skip, limit: 100 });
      let result = await requestPage(0);
      let loadedCount = currentCollection ? result.books.length : result.items.length;
      while (loadedCount < desiredCount && loadedCount < result.total && generation === collectionRequestGenerationRef.current) {
        const page = await requestPage(loadedCount);
        if (currentCollection) result = { ...result, books: [...result.books, ...page.books] };
        else result = { ...result, items: [...result.items, ...page.items] };
        const nextCount = currentCollection ? result.books.length : result.items.length;
        if (nextCount === loadedCount) break;
        loadedCount = nextCount;
      }
      if (generation === collectionRequestGenerationRef.current) {
        setCollectionBrowse(result);
        setCollectionHasMore(loadedCount < result.total);
      }
    }
  }

  async function handleTakeOut(bookId: number) {
    if (checkoutPending) return;
    setCheckoutPending(true);
    try { await reconcileCheckoutAction(await takeOutBook(bookId)); }
    catch (error) { console.error("Take Out failed", error); toast.error("Could not take book out"); }
    finally { setCheckoutPending(false); }
  }

  async function handleReturnPreview(bookId: number) {
    try { setReturnPreview(await getReturnPreview(bookId)); }
    catch (error) { console.error("Return preview failed", error); toast.error("Could not preview return"); }
  }

  async function handleConfirmReturn() {
    if (!returnPreview || checkoutPending) return;
    setCheckoutPending(true);
    try {
      const updated = await confirmReturnBook(returnPreview.book.id);
      setReturnPreview(null);
      await reconcileCheckoutAction(updated);
    } catch (error) { console.error("Confirm Return failed", error); toast.error("Could not return book"); }
    finally { setCheckoutPending(false); }
  }

  useEffect(() => {
    if (!groupByLocation) {
      groupedRequestGenerationRef.current += 1;
      setGroupedLoading(false);
      setGroupedError(null);
      return;
    }
    const generation = ++groupedRequestGenerationRef.current;
    let cancelled = false;
    setGroupedLoading(true);
    setGroupedError(null);
    void getGroupedBooks({
      search: filters.search,
      categoryId: filters.categoryId,
      locationId: filters.locationId,
      read: filters.read,
    }).then((result) => {
      if (cancelled || generation !== groupedRequestGenerationRef.current) return;
      setGroupedBooks(result);
    }).catch((error) => {
      if (cancelled || generation !== groupedRequestGenerationRef.current) return;
      console.error("Failed to load grouped books", error);
      setGroupedBooks(null);
      setGroupedError("Books could not be loaded");
    }).finally(() => {
      if (!cancelled && generation === groupedRequestGenerationRef.current) setGroupedLoading(false);
    });
    return () => { cancelled = true; };
  }, [filters.categoryId, filters.locationId, filters.read, filters.search, groupByLocation, groupedRevision]);

  function collectionOptions(path: Series[]) {
    const current = path.at(-1) ?? null;
    return {
      search: filters.search,
      categoryId: filters.categoryId,
      locationId: filters.locationId,
      read: filters.read,
      sort: current?.node_type === "series" ? collectionSort : "alphabetical" as const,
      rootMode: rootCollectionMode,
    };
  }

  function collectionBrowseKey(path: Series[]) {
    const options = collectionOptions(path);
    return JSON.stringify({ collectionId: path.at(-1)?.id ?? null, ...options });
  }

  function collectionRequest(path: Series[]) {
    const current = path.at(-1) ?? null;
    const options = collectionOptions(path);
    return current ? browseCollection(current.id, options) : browseRootCollections(options);
  }

  useEffect(() => {
    const snapshot = rootCollectionSnapshotRef.current;
    if (snapshot && snapshot.key !== collectionBrowseKey([])) rootCollectionSnapshotRef.current = null;
  }, [filters.categoryId, filters.locationId, filters.read, filters.search, rootCollectionMode]);

  useLayoutEffect(() => {
    const scrollY = pendingRootScrollRestoreRef.current;
    if (scrollY === null || collectionPath.length !== 0) return;
    pendingRootScrollRestoreRef.current = null;
    window.scrollTo({ top: scrollY, behavior: "auto" });
  }, [collectionBrowse, collectionPath.length]);

  useEffect(() => {
    if (groupByLocation) return;
    if ((!showCollections || viewMode !== "grid") && !currentCollection) {
      collectionRequestGenerationRef.current += 1;
      collectionPageRequestGenerationRef.current += 1;
      collectionBrowseKeyRef.current = null;
      rootCollectionSnapshotRef.current = null;
      setCollectionPageLoading(false);
      setCollectionBrowse(null);
      setCollectionHasMore(false);
      return;
    }
    const browseKey = collectionBrowseKey(collectionPath);
    if (collectionBrowseKeyRef.current === browseKey) return;

    const generation = ++collectionRequestGenerationRef.current;
    collectionPageRequestGenerationRef.current += 1;
    setCollectionPageLoading(false);
    let cancelled = false;
    setCollectionLoading(true);
    const request = collectionRequest(collectionPath);
    void request.then((result) => {
      if (cancelled || generation !== collectionRequestGenerationRef.current) return;
      collectionBrowseKeyRef.current = browseKey;
      setCollectionBrowse(result);
      const loadedCount = currentCollection ? result.books.length : result.items.length;
      setCollectionHasMore(loadedCount < result.total);
    }).catch((error) => { if (!cancelled && generation === collectionRequestGenerationRef.current) { console.error("Failed to browse collections", error); setCollectionBrowse(null); setCollectionHasMore(false); } }).finally(() => { if (!cancelled && generation === collectionRequestGenerationRef.current) setCollectionLoading(false); });
    return () => { cancelled = true; };
  }, [collectionRevision, collectionSort, currentCollection?.id, filters.categoryId, filters.locationId, filters.read, filters.search, rootCollectionMode, showCollections, viewMode, groupByLocation]);

  const loadMoreRootCollectionItems = useCallback(() => {
    if (collectionLoading || !collectionHasMore || !collectionBrowse) return;
    setCollectionLoading(true);
    const options = { search: filters.search, categoryId: filters.categoryId, locationId: filters.locationId, read: filters.read, rootMode: rootCollectionMode, skip: collectionBrowse.items.length };
    void browseRootCollections(options).then((result) => {
      setCollectionBrowse((current) => current ? { ...result, items: [...current.items, ...result.items] } : result);
      setCollectionHasMore(collectionBrowse.items.length + result.items.length < result.total);
    }).catch((error) => {
      console.error("Failed to load more root collection items", error);
    }).finally(() => setCollectionLoading(false));
  }, [collectionBrowse, collectionHasMore, collectionLoading, filters.categoryId, filters.locationId, filters.read, filters.search, rootCollectionMode]);

  const loadMoreCollectionBooks = useCallback(() => {
    if (!currentCollection || collectionLoading || collectionPageLoading || !collectionHasMore || !collectionBrowse) return;
    const browseKey = collectionBrowseKey(collectionPath);
    const generation = collectionRequestGenerationRef.current;
    const pageGeneration = ++collectionPageRequestGenerationRef.current;
    const skip = collectionBrowse.books.length;
    setCollectionPageLoading(true);
    void browseCollection(currentCollection.id, { ...collectionOptions(collectionPath), skip }).then((result) => {
      if (generation !== collectionRequestGenerationRef.current || pageGeneration !== collectionPageRequestGenerationRef.current || collectionBrowseKeyRef.current !== browseKey) return;
      setCollectionBrowse((current) => current ? {
        ...result,
        collections: current.collections,
        books: [...current.books, ...result.books.filter((book) => !current.books.some((existing) => existing.id === book.id))],
      } : result);
      setCollectionHasMore(skip + result.books.length < result.total);
    }).catch((error) => {
      if (generation === collectionRequestGenerationRef.current && pageGeneration === collectionPageRequestGenerationRef.current) console.error("Failed to load more collection books", error);
    }).finally(() => { if (pageGeneration === collectionPageRequestGenerationRef.current) setCollectionPageLoading(false); });
  }, [collectionBrowse, collectionHasMore, collectionLoading, collectionPageLoading, collectionPath, currentCollection, filters.categoryId, filters.locationId, filters.read, filters.search, rootCollectionMode, collectionSort]);

  const navigateToCollectionPath = useCallback((nextPath: Series[]) => {
    const nextSort = "reading" as const;
    const options = {
      search: filters.search,
      categoryId: filters.categoryId,
      locationId: filters.locationId,
      read: filters.read,
      sort: nextPath.at(-1)?.node_type === "series" ? nextSort : "alphabetical" as const,
      rootMode: rootCollectionMode,
    };
    const browseKey = JSON.stringify({ collectionId: nextPath.at(-1)?.id ?? null, ...options });
    const generation = ++collectionRequestGenerationRef.current;
    collectionPageRequestGenerationRef.current += 1;
    setCollectionPageLoading(false);
    const rootSnapshot = nextPath.length === 0 ? rootCollectionSnapshotRef.current : null;
    if (rootSnapshot?.key === browseKey) {
      rootCollectionSnapshotRef.current = null;
      collectionBrowseKeyRef.current = browseKey;
      pendingRootScrollRestoreRef.current = rootSnapshot.scrollY;
      setCollectionSort(nextSort);
      setCollectionPath(nextPath);
      setCollectionBrowse(rootSnapshot.browse);
      setCollectionHasMore(rootSnapshot.hasMore);
      return;
    }
    const nextCollection = nextPath.at(-1) ?? null;
    const request = nextCollection ? browseCollection(nextCollection.id, options) : browseRootCollections(options);

    void request.then((result) => {
      if (generation !== collectionRequestGenerationRef.current) return;
      collectionBrowseKeyRef.current = browseKey;
      setCollectionSort(nextSort);
      setCollectionPath(nextPath);
      setCollectionBrowse(result);
      const loadedCount = nextCollection ? result.books.length : result.items.length;
      setCollectionHasMore(loadedCount < result.total);
    }).catch((error) => {
      if (generation === collectionRequestGenerationRef.current) console.error("Failed to navigate collections", error);
    });
  }, [filters.categoryId, filters.locationId, filters.read, filters.search, rootCollectionMode]);

  function enterCollection(collection: Series) {
    if (collectionPath.length === 0 && collectionBrowse && collectionBrowseKeyRef.current === collectionBrowseKey([])) {
      rootCollectionSnapshotRef.current = {
        browse: collectionBrowse,
        hasMore: collectionHasMore,
        key: collectionBrowseKey([]),
        scrollY: window.scrollY,
      };
    }
    navigateToCollectionPath([...collectionPath, collection]);
  }

  function goToCollection(level: number) {
    navigateToCollectionPath(collectionPath.slice(0, level));
  }

  const hasActiveCollectionFilter = Boolean(filters.search?.trim() || filters.categoryId != null || filters.locationId != null || filters.read != null);
  const collectionEmpty = Boolean(currentCollection && collectionBrowse && !collectionLoading && !collectionPageLoading && collectionBrowse.books.length === 0 && collectionBrowse.collections.length === 0 && outBooks.length === 0);

  async function handleViewModeChange(mode: LibraryViewMode) {
    try {
      await updatePreferences({
        library_view_mode: mode,
      });
    } catch (err) {
      console.error(err);

      toast.error("Failed to update view mode");
    }
  }

  function handleLocationFilterChange(value: number | null) {
    setSelectedLocation(value);
    updateFilters({ locationId: value });
  }

  function handleCategoryFilterChange(value: number | null) {
    setSelectedCategory(value);
    updateFilters({ categoryId: value });
  }

  // -------------------
  // 📜 INFINITE SCROLL
  // -------------------

  useEffect(() => {
    function handleScroll() {
      if (groupByLocation) return;
      if (showCollections && (viewMode === "grid" || currentCollection)) {
        if (!collectionHasMore || collectionLoading || collectionPageLoading) return;
        const bottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;
        if (bottom) {
          if (currentCollection) loadMoreCollectionBooks();
          else loadMoreRootCollectionItems();
        }
        return;
      }
      if (!hasMore || isLoading) return;

      const bottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;

      if (bottom) {
        loadMoreBooks();
      }
    }

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, [books, collectionHasMore, collectionLoading, collectionPageLoading, currentCollection, hasMore, isLoading, loadMoreCollectionBooks, loadMoreRootCollectionItems, showCollections, viewMode, groupByLocation]);

  useEffect(() => {
    function isPanelBottomAtThreshold() {
      const panel = searchPanelRef.current;
      const anchor = searchPanelFlowAnchorRef.current;

      if (!panel || !anchor) return false;

      const panelStyles = window.getComputedStyle(panel);
      const stickyTop = Number.parseFloat(panelStyles.top);
      if (Number.isFinite(stickyTop)) {
        searchPanelStickyOffsetRef.current = stickyTop;
      }
      const measuredMarginTop = Number.parseFloat(panelStyles.marginTop);
      const marginTop = Number.isFinite(measuredMarginTop) ? measuredMarginTop : 0;
      const naturalBottom =
        anchor.getBoundingClientRect().top + marginTop + panel.offsetHeight;

      return naturalBottom <= searchPanelStickyOffsetRef.current + 0.5;
    }

    function restorePanel() {
      setIsSearchPanelPastThreshold(false);
      setIsScrolling(false);

      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
        scrollEndTimerRef.current = null;
      }
    }

    function handleScrollActivity() {
      if (!isPanelBottomAtThreshold()) {
        restorePanel();
        return;
      }

      setIsSearchPanelPastThreshold(true);
      setIsScrolling(true);

      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }

      scrollEndTimerRef.current = setTimeout(() => {
        setIsSearchPanelPastThreshold(false);
        setIsScrolling(false);
        scrollEndTimerRef.current = null;
      }, 750);
    }

    function handleResize() {
      if (!isPanelBottomAtThreshold()) {
        restorePanel();
      } else {
        setIsSearchPanelPastThreshold(true);
      }
    }

    window.addEventListener("scroll", handleScrollActivity, { passive: true });
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScrollActivity);
      window.removeEventListener("resize", handleResize);

      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }
    };
  }, []);

  // -------------------
  // 🔐 LOGIN
  // -------------------

  async function handleLogin() {
    try {
      const token = await loginApi(username, password);

      login(token);

      toast.success("Logged in");
    } catch (err) {
      console.error(err);

      toast.error("Login failed");
    }
  }

  // -------------------
  // 🚪 LOGOUT
  // -------------------

  function handleLogout() {
    cancelPendingBookOpen();
    logout();

    setSelectedBook(null);

    setNewBook({});
  }

  async function openMaintenanceReview(bookId: number, target: ReviewTarget, guided = false, followUp: ReviewTarget | null = null) {
    cancelPendingBookOpen();
    try {
      const book = await getBook(bookId);
      setSelectedBook(null);
      setEditData(null);
      setEditing(false);
      setReviewSession({
        book,
        target,
        guided,
        followUp,
        origin: guided ? "maintenance_guided" : "maintenance_direct",
      });
    } catch (err) {
      console.error("Failed to open review", err);
      toast.error("Book could not be opened for review");
    }
  }

  async function saveReviewDraft(book: Book, reviewIntent: ReviewIntent) {
    const updated = await saveBook(book, reviewIntent);
    toast.success("Book updated");
    return updated;
  }

  // -------------------
  // 🧱 RENDER
  // -------------------

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas text-text-primary">
        <div className="bg-gray-900 border border-gray-800 p-6 rounded-xl w-80">
          <h2 className="text-xl mb-4">Login</h2>

          <input
            placeholder="Username"
            className="p-2 bg-gray-800 w-full mb-2 rounded"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            placeholder="Password"
            type="password"
            className="p-2 bg-gray-800 w-full mb-4 rounded"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <ActionButton
            onClick={handleLogin}
            variant="primary"
            className="w-full"
          >
            Login
          </ActionButton>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-canvas text-text-primary p-6"
      onClick={() => {
        cancelPendingBookOpen();
        setSelectedBook(null);

        setEditing(false);
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Header
          libraryName={libraryName}
          onOpenSettings={() => setShowSettings(true)}
          onLogout={handleLogout}
        />

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onReviewBook={openMaintenanceReview}
          onViewBook={async (bookId) => {
            setShowSettings(false);
            await openBook(bookId);
          }}
          reviewSaved={reviewSaved}
          evidenceRefreshVersion={evidenceRefreshVersion}
          onCollectionsChanged={() => {
            if (showCollections && viewMode === "grid" && collectionPath.length === 0) {
              setCollectionRevision((revision) => revision + 1);
            }
          }}
          onReviewSequenceComplete={() => {
            setSelectedBook(null);
            setEditing(false);
            setReviewSession(null);
          }}
        />

        <TopPanels />

        {/* SEARCH + FILTERS */}
        <div ref={searchPanelFlowAnchorRef} aria-hidden="true" />
        <div
          ref={searchPanelRef}
          className={`${
            isSearchPanelPastThreshold ? "relative" : "sticky top-4"
          } z-40 mt-4`}
        >
          <div className="md:mx-auto md:w-[calc(100%_-_3rem)]">
            <SearchBar
              searchInput={searchInput}
              onSearchChange={setSearchInput}
              isScrolling={
                viewMode === "grid" &&
                isSearchPanelPastThreshold &&
                isScrolling
              }
              selectedLocation={selectedLocation}
              onLocationChange={handleLocationFilterChange}
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryFilterChange}
              locations={locations}
              categories={categories}
              onCheckLibrary={() => setShowCheckLibrary(true)}
              onAddBook={() => setShowAddBook(true)}
            />
          </div>
        </div>

        {!groupByLocation && showCollections && currentCollection && (
          <nav className="mb-2 mt-3 px-1 text-sm text-text-secondary" aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-x-1 gap-y-1">
              <li><button type="button" onClick={() => goToCollection(0)} className="rounded px-1 py-1 hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">Library</button></li>
              {collectionPath.map((item, index) => <Fragment key={item.id}><li aria-hidden="true" className="px-0.5 text-text-muted">›</li><li className="min-w-0">{index === collectionPath.length - 1 ? <span aria-current="page" className="block max-w-40 truncate px-1 py-1 font-medium text-text-primary">{item.name}</span> : <button type="button" onClick={() => goToCollection(index + 1)} className="block max-w-40 truncate rounded px-1 py-1 hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas">{item.name}</button>}</li></Fragment>)}
            </ol>
          </nav>
        )}

        <div className={"mb-3 flex min-h-12 items-center justify-between gap-3 px-1 " + (!groupByLocation && currentCollection ? "mt-0" : "mt-3")}>
          <div className="min-w-0">
            {groupedLoading || isLoading || (!groupByLocation && collectionLoading) ? (
              <div className="text-sm text-text-muted">Searching...</div>
            ) : groupedError || loadError ? (
              <div className="text-sm text-danger">{groupedError || loadError}</div>
            ) : (
              <h2 className={!groupByLocation && currentCollection ? "text-base font-semibold text-text-primary" : "text-sm font-medium text-text-secondary"}>{!groupByLocation && currentCollection ? currentCollection.name : "Books"}</h2>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {!groupByLocation && currentCollection?.node_type === "series" && <label className="flex items-center gap-2 text-xs"><span className="sr-only">Collection sort</span><select value={collectionSort} onChange={(event) => setCollectionSort(event.target.value as typeof collectionSort)} className="form-control max-w-44 py-1.5 text-xs"><option value="reading">Reading order</option><option value="publication">Publication order</option><option value="chronological">Chronological order</option><option value="alphabetical">Alphabetical</option></select></label>}
            <label className="flex cursor-pointer items-center gap-2 text-xs text-text-secondary"><input type="checkbox" checked={groupByLocation} onChange={(event) => setGroupByLocation(event.target.checked)} className="accent-blue-600" />Group by Location</label>
            <ViewModeSwitcher value={viewMode} onChange={handleViewModeChange} />
          </div>
        </div>

        <OutOfLibrary books={outBooks} onSelect={(book) => { void openBook(book, Boolean(currentCollection)); }} />

        {/* BOOK VIEWS */}
        {groupByLocation ? groupedError ? null : groupedBooks && groupedBooks.locations.length === 0 && !groupedBooks.no_location && outBooks.length === 0 ? (
          <p className="px-1 py-6 text-sm text-text-muted">{filters.search?.trim() || filters.categoryId != null || filters.locationId != null || filters.read != null ? "No matching books." : "Your library is empty."}</p>
        ) : groupedBooks ? (
          <GroupedLocationBooks data={groupedBooks} viewMode={viewMode} locations={locations} categories={categories} showCovers={showCoversInList} onSelect={(book) => { void openBook(book, false); }} onUnassignedSelect={(book) => setSuggestedAssignment({ book, location: null })} />
        ) : null : collectionEmpty ? (
          <p className="px-1 py-6 text-sm text-text-muted">{hasActiveCollectionFilter ? "No matching books in this collection." : "This collection is empty."}</p>
        ) : viewMode === "grid" ? (
          <BookGridView
            books={collectionBrowse ? collectionBrowse.books : books}
            collections={collectionBrowse?.collections}
            items={!currentCollection ? collectionBrowse?.items : undefined}
            onSelectCollection={enterCollection}
            onSelect={(book) => {
              void openBook(book, Boolean(currentCollection));
            }}
          />
        ) : (
          <BookListView
            books={currentCollection && collectionBrowse ? collectionBrowse.books as Book[] : books}
            locations={locations}
            categories={categories}
            showCovers={showCoversInList}
            onSelect={(book) => {
              void openBook(book, Boolean(currentCollection));
            }}
          />
        )}

        {selectedBook && (
          <BookPanel
            book={selectedBook}
            openedInCollection={selectedBookOpenedInCollection}
            editing={editing}
            editData={editData}
            setEditing={setEditing}
            setEditData={(b) => setEditData(b)}
            onClose={() => {
              cancelPendingBookOpen();
              setSelectedBook(null);
              setSelectedBookOpenedInCollection(false);
            }}
            onSave={handleSave}
            onDelete={handleDelete}
            onTakeOut={(id) => { void handleTakeOut(id); }}
            onReturnToShelf={(id) => { void handleReturnPreview(id); }}
            checkoutPending={checkoutPending}
          />
        )}

        <SuggestedLocationAssignmentDialog
          assignment={suggestedAssignment}
          assigning={assigningSuggestedLocation}
          onClose={() => setSuggestedAssignment(null)}
          onSelectLocation={(location) => setSuggestedAssignment((current) => current && { ...current, location })}
          onBack={() => setSuggestedAssignment((current) => current && { ...current, location: null })}
          onConfirm={() => void confirmSuggestedLocationAssignment()}
          onViewBook={() => { if (suggestedAssignment) { const book = suggestedAssignment.book; setSuggestedAssignment(null); void openBook(book, false); } }}
        />

        <ReturnToShelfDialog preview={returnPreview} confirming={checkoutPending} onClose={() => setReturnPreview(null)} onConfirm={() => { void handleConfirmReturn(); }} />

        <AddBookDialog
          open={showAddBook}
          onClose={closeAddBook}
          newBook={newBook}
          setNewBook={setNewBook}
          onSearch={handleSearch}
          onAdd={handlePrimaryAdd}
          onAddReview={handleAddAndReviewFlow}
          canAddReview={Boolean(draftOrigin !== "catalog-search" && newBook.isbn?.trim() && newBook.title && newBook.author)}
          onReset={resetAddBook}
          onISBNChange={handleAddBookISBNChange}
          onCatalogCandidateSelected={handleCatalogCandidateSelected}
          isFetching={isFetching}
        />

        <CheckLibraryDialog
          open={showCheckLibrary}
          onClose={() => setShowCheckLibrary(false)}
          onViewBook={(book) => {
            setShowCheckLibrary(false);
            void openBook(book);
          }}
          onAddBook={(draft) => {
            setShowCheckLibrary(false);
            setNewBook(draft);
            setShowAddBook(true);
          }}
        />

        {reviewSession && (
          <MaintenanceReviewSession
            onEvidenceRefreshed={() => setEvidenceRefreshVersion((version) => version + 1)}
            book={reviewSession.book}
            initialTarget={reviewSession.target}
            origin={reviewSession.origin}
            followUp={reviewSession.followUp}
            onSave={saveReviewDraft}
            onSaved={(updated, origin) => {
              if (origin === "add_review") {
                resetAddBook();
                toast.success("Book added and reviewed");
              } else {
                setReviewSaved({
                  bookId: updated.id,
                  nonce: Date.now(),
                  guided: origin === "maintenance_guided",
                });
              }
              setReviewSession(null);
            }}
            onCancel={() => {
              if (reviewSession.origin === "add_review") {
                resetAddBook();
                toast("Book added. Review can be completed later in Maintenance.");
              }
              setReviewSession(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
