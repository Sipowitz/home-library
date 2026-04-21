import { useEffect, useState } from "react";
import { Book as BookIcon, LogOut, Settings } from "lucide-react";

import { login } from "./api/auth";
import { previewBookByISBN } from "./api/books";

import { useBooks } from "./hooks/useBooks";
import { useLocations } from "./context/LocationContext";

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

  // -------------------
  // 🔍 FILTER STATE
  // -------------------
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(""); // ✅ NEW
  const [selectedLocation, setSelectedLocation] = useState<number | null>(null);

  const [loggedIn, setLoggedIn] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [newBook, setNewBook] = useState<Partial<Book>>({});
  const [isFetching, setIsFetching] = useState(false);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Book | null>(null);

  const [showSettings, setShowSettings] = useState(false);

  // -------------------
  // 🔐 AUTH INIT
  // -------------------
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setLoggedIn(true);
      loadBooks();
    }
  }, []);

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
    if (!loggedIn) return;

    updateFilters({
      search: debouncedSearch,
      locationId: selectedLocation,
    });
  }, [debouncedSearch, selectedLocation, loggedIn]);

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

  async function handleLogin() {
    try {
      await login(username, password);
      setLoggedIn(true);
      loadBooks();
      toast.success("Logged in");
    } catch (err) {
      console.error(err);
      toast.error("Login failed");
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setLoggedIn(false);
    setSelectedBook(null);
    setNewBook({});
    window.location.reload();
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

  if (!loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-white">
        <div className="bg-gray-800 p-6 rounded-xl w-80">
          <h2 className="text-xl mb-4">Login</h2>

          <input
            placeholder="Username"
            className="p-2 bg-gray-700 w-full mb-2 rounded"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <input
            placeholder="Password"
            type="password"
            className="p-2 bg-gray-700 w-full mb-4 rounded"
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
      className="min-h-screen bg-gray-950 text-white p-4"
      onClick={() => {
        setSelectedBook(null);
        setEditing(false);
      }}
    >
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl flex items-center gap-2">
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

      {/* 🔍 FILTER BAR */}
      <div className="flex gap-2 mb-4">
        <input
          placeholder="Search title or author..."
          className="p-2 bg-gray-800 rounded w-full"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />

        <select
          className="p-2 bg-gray-800 rounded"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6 items-start">
        <div className="lg:col-span-1">
          <AddBookForm
            newBook={newBook}
            setNewBook={setNewBook}
            onSearch={handleSearch}
            onAdd={handleAddBook}
            isFetching={isFetching}
          />
        </div>

        <div className="lg:col-span-2">
          <StatsPanel books={books} />
        </div>
      </div>

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
