import { useEffect, useState, useMemo } from "react";

import { login as loginApi } from "./api/auth";

import { useBooks } from "./hooks/useBooks";
import { useLocations } from "./context/LocationContext";
import { useAuth } from "./context/AuthContext";
import { useSearch } from "./hooks/useSearch";
import { useBookActions } from "./hooks/useBookActions";

import { BookGrid } from "./components/books/BookGrid";
import { SettingsModal } from "./components/settings/SettingsModal";
import { BookPanel } from "./components/books/BookPanel";

import { SearchBar } from "./components/search/SearchBar";
import { TopPanels } from "./components/layout/TopPanels";
import { Header } from "./components/layout/Header";

import toast from "react-hot-toast";

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
  warning?: string;
};

type Location = {
  id: number;
  name: string;
  parent_id?: number;
  children?: Location[];
};

export default function App() {
  const {
    books,
    loadBooks,
    loadMoreBooks,
    hasMore,
    addBook,
    addBookFromISBN,
    removeBook,
    saveBook,
    updateFilters,
    isLoading,
  } = useBooks();

  const { locations } = useLocations();
  const { isAuthenticated, login, logout } = useAuth();

  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  const { searchInput, setSearchInput } = useSearch({
    isAuthenticated,
    selectedLocation,
    updateFilters,
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [newBook, setNewBook] = useState<Partial<Book>>({});
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Book | null>(null);

  const [showSettings, setShowSettings] = useState(false);

  const { isFetching, handleSearch, handleAddBook, handleDelete, handleSave } =
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

  // -------------------
  // 🔽 GET DESCENDANT IDS
  // -------------------
  function getDescendantIds(nodes: Location[], parentId: number): number[] {
    const result: number[] = [];

    function walk(node: Location) {
      result.push(node.id);
      if (node.children) {
        node.children.forEach(walk);
      }
    }

    function find(nodes: Location[]) {
      for (const node of nodes) {
        if (node.id === parentId) {
          walk(node);
        } else if (node.children) {
          find(node.children);
        }
      }
    }

    find(nodes);
    return result;
  }

  // -------------------
  // ⚡ CLIENT-SIDE FILTER
  // -------------------
  const filteredBooks = useMemo(() => {
    let result = books;

    if (searchInput.trim()) {
      const q = searchInput.toLowerCase();

      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.author.toLowerCase().includes(q),
      );
    }

    if (selectedLocation === -1) {
      result = result.filter((b) => !b.location_id);
    } else if (selectedLocation !== null) {
      const ids = getDescendantIds(locations, selectedLocation);

      result = result.filter((b) => ids.includes(b.location_id ?? -999));
    }

    return result;
  }, [books, searchInput, selectedLocation, locations]);

  // -------------------
  // 📜 INFINITE SCROLL
  // -------------------
  useEffect(() => {
    function handleScroll() {
      if (!hasMore) return;

      const bottom =
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200;

      if (bottom) {
        loadMoreBooks();
      }
    }

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, books]);

  // -------------------
  // 🔐 LOGIN
  // -------------------
  async function handleLogin() {
    try {
      const token = await loginApi(username, password);

      login(token);
      loadBooks();

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
      <Header
        onOpenSettings={() => setShowSettings(true)}
        onLogout={handleLogout}
      />

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <TopPanels
        newBook={newBook}
        setNewBook={setNewBook}
        onSearch={handleSearch}
        onAdd={handleAddBook}
        isFetching={isFetching}
      />

      {/* ✅ STICKY + SPACING FIX */}
      <div className="mt-6 sticky top-4 z-40 backdrop-blur bg-gray-950/80">
        <SearchBar
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          locations={locations}
        />
      </div>

      <div className="h-6 mb-3 px-1 flex items-center">
        {isLoading && <div className="text-sm text-gray-400">Searching...</div>}
      </div>

      <BookGrid
        books={filteredBooks}
        onSelect={(book) => {
          setSelectedBook(book);
          setEditing(false);
        }}
      />

      <BookPanel
        book={selectedBook}
        editing={editing}
        editData={editData}
        setEditing={setEditing}
        setEditData={(b) => setEditData(b)}
        onClose={() => setSelectedBook(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
