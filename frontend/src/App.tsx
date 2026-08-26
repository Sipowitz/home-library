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

import { SearchBar } from "./components/search/SearchBar";
import { TopPanels } from "./components/layout/TopPanels";
import { Header } from "./components/layout/Header";

import toast from "react-hot-toast";

import type { Book, BookDraft } from "./types/book";
import type { LibraryViewMode } from "./types/preferences";
import { getBook } from "./api/books";
import type { ReviewTarget } from "./components/settings/maintenance/MaintenanceSettings";

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
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [maintenanceReviewActive, setMaintenanceReviewActive] = useState(false);
  const [reviewSaved, setReviewSaved] = useState<{ bookId: number; nonce: number } | null>(null);

  const [isScrolling, setIsScrolling] = useState(false);
  const [isSearchPanelSticky, setIsSearchPanelSticky] = useState(false);

  const scrollEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchPanelRef = useRef<HTMLDivElement | null>(null);

  const {
    isFetching,
    handleSearch,
    handleAddBook,
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
    function isPanelAtStickyThreshold() {
      const panel = searchPanelRef.current;

      if (!panel) return false;

      const stickyTop = Number.parseFloat(window.getComputedStyle(panel).top);
      const topOffset = Number.isFinite(stickyTop) ? stickyTop : 0;

      return panel.getBoundingClientRect().top <= topOffset + 0.5;
    }

    function restorePanel() {
      setIsSearchPanelSticky(false);
      setIsScrolling(false);

      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
        scrollEndTimerRef.current = null;
      }
    }

    function handleScrollActivity() {
      if (!isPanelAtStickyThreshold()) {
        restorePanel();
        return;
      }

      setIsSearchPanelSticky(true);
      setIsScrolling(true);

      if (scrollEndTimerRef.current) {
        clearTimeout(scrollEndTimerRef.current);
      }

      scrollEndTimerRef.current = setTimeout(() => {
        setIsScrolling(false);
        scrollEndTimerRef.current = null;
      }, 3000);
    }

    function handleResize() {
      if (!isPanelAtStickyThreshold()) {
        restorePanel();
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

  async function openMaintenanceReview(bookId: number, target: ReviewTarget) {
    try {
      const book = await getBook(bookId);
      setSelectedBook(book);
      setEditData(book);
      setReviewTarget(target);
      setMaintenanceReviewActive(true);
      setEditing(true);
    } catch (err) {
      console.error("Failed to open review", err);
      toast.error("Book could not be opened for review");
    }
  }

  async function saveAndContinueReview(reviewIntent = {}) {
    const updated = await handleSave(reviewIntent);
    if (updated && maintenanceReviewActive) {
      setReviewSaved({ bookId: updated.id, nonce: Date.now() });
    }
  }

  // -------------------
  // 🧱 RENDER
  // -------------------

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
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

          <button
            onClick={handleLogin}
            className="bg-blue-600 w-full py-2 rounded"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-950 text-white p-6"
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
            setMaintenanceReviewActive(false);
            setReviewTarget(null);
          }}
        />

        <TopPanels
          newBook={newBook}
          setNewBook={setNewBook}
          onSearch={handleSearch}
          onAdd={handleAddBook}
          onReset={resetAddBook}
          onISBNChange={handleAddBookISBNChange}
          isFetching={isFetching}
        />

        {/* SEARCH + FILTERS */}
        <div ref={searchPanelRef} className="sticky top-4 z-40 mt-4">
          <div className="md:mx-auto md:w-[calc(100%_-_3rem)]">
            <SearchBar
              searchInput={searchInput}
              onSearchChange={setSearchInput}
              isScrolling={
                viewMode === "grid" && isSearchPanelSticky && isScrolling
              }
              selectedLocation={selectedLocation}
              onLocationChange={handleLocationFilterChange}
              selectedCategory={selectedCategory}
              onCategoryChange={handleCategoryFilterChange}
              locations={locations}
              categories={categories}
            />
          </div>
        </div>

        <div className="mb-3 mt-3 flex min-h-12 items-center justify-between gap-3 px-1">
          <div className="min-w-0">
            {isLoading ? (
              <div className="text-sm text-gray-400">Searching...</div>
            ) : loadError ? (
              <div className="text-sm text-red-300">{loadError}</div>
            ) : (
              <h2 className="text-sm font-medium text-gray-300">Books</h2>
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
              setReviewTarget(null);

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
              setReviewTarget(null);

              setEditing(false);
            }}
          />
        )}

        <BookPanel
          book={selectedBook}
          editing={editing}
          editData={editData}
          setEditing={setEditing}
          setEditData={(b) => setEditData(b)}
          onClose={() => {
            setSelectedBook(null);
            setMaintenanceReviewActive(false);
            setReviewTarget(null);
          }}
          onSave={saveAndContinueReview}
          onDelete={handleDelete}
          initialReviewTarget={reviewTarget}
        />
      </div>
    </div>
  );
}
