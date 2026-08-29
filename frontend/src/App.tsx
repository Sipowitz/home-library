import { useEffect, useRef, useState } from "react";

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
import { getBook } from "./api/books";
import type { ReviewTarget } from "./components/settings/maintenance/MaintenanceSettings";
import type { ReviewIntent } from "./api/books";

export default function App() {
  const {
    books,
    loadMoreBooks,
    hasMore,
    addBook,
    addBookFromISBN,
    removeBook,
    saveBook,
    updateFilters,
    isLoading,
    loadError,
  } = useBooks();

  const { locations } = useLocations();

  const { categories } = useCategories();

  const { isAuthenticated, login, logout } = useAuth();

  const { preferences, updatePreferences } = usePreferences();

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

  const [isScrolling, setIsScrolling] = useState(false);
  const [isSearchPanelPastThreshold, setIsSearchPanelPastThreshold] =
    useState(false);

  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);
  const searchPanelFlowAnchorRef = useRef<HTMLDivElement | null>(null);
  const searchPanelStickyOffsetRef = useRef(0);

  const {
    isFetching,
    handleSearch,
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
    });

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
    if (newBook.isbn?.trim()) {
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
      if (!hasMore || isLoading) return;

      const bottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;

      if (bottom) {
        loadMoreBooks();
      }
    }

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoading, books]);

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
    logout();

    setSelectedBook(null);

    setNewBook({});
  }

  async function openMaintenanceReview(bookId: number, target: ReviewTarget, guided = false, followUp: ReviewTarget | null = null) {
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
        setSelectedBook(null);

        setEditing(false);
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Header
          onOpenSettings={() => setShowSettings(true)}
          onLogout={handleLogout}
        />

        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onReviewBook={openMaintenanceReview}
          reviewSaved={reviewSaved}
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

        <div className="mb-3 mt-3 flex min-h-12 items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            {isLoading ? (
              <div className="text-sm text-text-muted">Searching...</div>
            ) : loadError ? (
              <div className="text-sm text-danger">{loadError}</div>
            ) : (
              <h2 className="text-sm font-medium text-text-secondary">Books</h2>
            )}
          </div>

          <ViewModeSwitcher
            value={viewMode}
            onChange={handleViewModeChange}
          />
        </div>

        {/* BOOK VIEWS */}
        {viewMode === "grid" ? (
          <BookGridView
            books={books}
            onSelect={(book) => {
              setSelectedBook(book);

              setEditing(false);
            }}
          />
        ) : (
          <BookListView
            books={books}
            locations={locations}
            categories={categories}
            showCovers={showCoversInList}
            onSelect={(book) => {
              setSelectedBook(book);

              setEditing(false);
            }}
          />
        )}

        {selectedBook && (
          <BookPanel
            book={selectedBook}
            editing={editing}
            editData={editData}
            setEditing={setEditing}
            setEditData={(b) => setEditData(b)}
            onClose={() => {
              setSelectedBook(null);
            }}
            onSave={handleSave}
            onDelete={handleDelete}
          />
        )}

        <AddBookDialog
          open={showAddBook}
          onClose={closeAddBook}
          newBook={newBook}
          setNewBook={setNewBook}
          onSearch={handleSearch}
          onAdd={handlePrimaryAdd}
          onAddReview={handleAddAndReviewFlow}
          canAddReview={Boolean(newBook.isbn?.trim() && newBook.title && newBook.author)}
          onReset={resetAddBook}
          onISBNChange={handleAddBookISBNChange}
          isFetching={isFetching}
        />

        <CheckLibraryDialog
          open={showCheckLibrary}
          onClose={() => setShowCheckLibrary(false)}
          onViewBook={(book) => {
            setShowCheckLibrary(false);
            setSelectedBook(book);
            setEditing(false);
          }}
          onAddBook={(draft) => {
            setShowCheckLibrary(false);
            setNewBook(draft);
            setShowAddBook(true);
          }}
        />

        {reviewSession && (
          <MaintenanceReviewSession
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
