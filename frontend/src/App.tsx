import { useEffect, useState } from "react";
import { Book as BookIcon, LogOut, Settings } from "lucide-react";

import { login as loginApi } from "./api/auth";
import { previewBookByISBN } from "./api/books";

import { useBooks } from "./hooks/useBooks";
import { useLocations } from "./context/LocationContext";
import { useAuth } from "./context/AuthContext"; // ✅ NEW

import { BookGrid } from "./components/books/BookGrid";
import { AddBookForm } from "./components/books/AddBookForm";
import { SettingsModal } from "./components/settings/SettingsModal";
import { BookPanel } from "./components/books/BookPanel";
import { StatsPanel } from "./components/stats/StatsPanel";

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
  } = useBooks();

  const { locations } = useLocations();

  // ✅ AUTH CONTEXT
  const { isAuthenticated, login, logout } = useAuth();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [newBook, setNewBook] = useState<Partial<Book>>({});
  const [isFetching, setIsFetching] = useState(false);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Book | null>(null);

  const [showSettings, setShowSettings] = useState(false);

  // -------------------
  // ⏱️ DEBOUNCE SEARCH
  // -------------------
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  // -------------------
  // 🔍 APPLY FILTERS
  // -------------------
  useEffect(() => {
    if (!isAuthenticated) return;

    updateFilters({
      search: debouncedSearch,
      locationId: selectedLocation,
    });
  }, [debouncedSearch, selectedLocation, isAuthenticated]);

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

      login(token); // ✅ central auth

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
    logout(); // ✅ central auth

    setSelectedBook(null);
    setNewBook({});
  }

  async function handleSearch() {
    if (!newBook.isbn) return;

    try {
      setIsFetching(true);

      const data = await previewBookByISBN(newBook.isbn);

      setNewBook((prev) => ({
        ...data,
        ...prev,
        read: prev.read ?? false,
        date_added: prev.date_added ?? new Date().toISOString(),
      }));

      toast.success("Book found");
    } catch (err) {
      console.error(err);
      toast.error("Book not found");
    } finally {
      setIsFetching(false);
    }
  }

  async function handleAddBook() {
    if (!newBook.title || !newBook.author) return;

    const payload = {
      title: newBook.title,
      author: newBook.author,
      year: newBook.year ?? null,
      isbn: newBook.isbn ?? "",
      description: newBook.description ?? "",
      read: newBook.read ?? false,
      location_id: newBook.location_id ?? null,
      cover_url: newBook.cover_url ?? "",
      category_ids: [],
      date_added: new Date().toISOString(),
    };

    try {
      const created = payload.isbn
        ? await addBookFromISBN(payload)
        : await addBook(payload);

      if (created.warning) {
        toast(created.warning);
      } else {
        toast.success("Book added");
      }

      setSelectedBook(created);
      setEditData(created);
      setEditing(true);

      setNewBook({});
    } catch (err) {
      console.error("ADD ERROR:", err);
      toast.error("Failed to add book");
    }
  }

  async function handleDelete(id: number) {
    await removeBook(id);
    setSelectedBook(null);
    toast.success("Book deleted");
  }

  async function handleSave(category_ids: number[]) {
    if (!editData) return;

    const payload = {
      ...editData,
      category_ids,
    };

    const updated = await saveBook(payload);

    setSelectedBook(updated);
    setEditData(updated);
    setEditing(false);

    toast.success("Book updated");
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
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl flex items-center gap-2 font-semibold">
          <BookIcon /> My Library
        </h1>

        <div className="flex gap-3">
          <button onClick={() => setShowSettings(true)}>
            <Settings size={20} />
          </button>
          <button onClick={handleLogout}>
            <LogOut />
          </button>
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* TOP PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-stretch">
        <div className="lg:col-span-1 h-full">
          <AddBookForm
            newBook={newBook}
            setNewBook={setNewBook}
            onSearch={handleSearch}
            onAdd={handleAddBook}
            isFetching={isFetching}
          />
        </div>

        <div className="lg:col-span-2 h-full">
          <StatsPanel />
        </div>
      </div>

      {/* SEARCH */}
      <div className="bg-gray-900/60 border border-gray-800 backdrop-blur p-4 rounded-2xl mb-6 flex gap-3 items-center">
        <input
          placeholder="Search title or author..."
          className="p-3 bg-gray-800 rounded-lg w-full outline-none focus:ring-2 focus:ring-blue-500"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <select
          className="p-3 bg-gray-800 rounded-lg"
          value={selectedLocation ?? ""}
          onChange={(e) =>
            setSelectedLocation(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All Locations</option>

          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      {/* GRID */}
      <BookGrid
        books={books}
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
