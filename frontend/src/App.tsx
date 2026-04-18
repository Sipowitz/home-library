import { useEffect, useState } from "react";
import { Book as BookIcon, LogOut, Settings } from "lucide-react";

import { login } from "./api/auth";
import { fetchBookByISBN } from "./api/googleBooks";

import { useBooks } from "./hooks/useBooks";

import { BookGrid } from "./components/books/BookGrid";
import { AddBookForm } from "./components/books/AddBookForm";
import { SettingsModal } from "./components/settings/SettingsModal";
import { BookPanel } from "./components/books/BookPanel";
import { StatsPanel } from "./components/stats/StatsPanel";

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
};

export default function App() {
  const { books, loadBooks, addBook, removeBook, saveBook } = useBooks();

  const [loggedIn, setLoggedIn] = useState(false);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [newBook, setNewBook] = useState<Partial<Book>>({});
  const [isFetching, setIsFetching] = useState(false);

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Book | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("google_api_key") || "",
  );

  // 🔐 CHECK LOGIN
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setLoggedIn(true);
      loadBooks();
    }
  }, []);

  // 🔐 LOGIN
  async function handleLogin() {
    try {
      await login(username, password);
      setLoggedIn(true);
      loadBooks();
    } catch (err) {
      console.error(err);
      alert("Login failed");
    }
  }

  // 🔐 LOGOUT
  function handleLogout() {
    localStorage.removeItem("token");
    setLoggedIn(false);
    setSelectedBook(null);
    setNewBook({});
    window.location.reload();
  }

  function saveSettings() {
    localStorage.setItem("google_api_key", apiKey);
    setShowSettings(false);
  }

  // 🔍 SEARCH ISBN
  async function handleSearch() {
    if (!newBook.isbn) return;

    try {
      setIsFetching(true);
      const data = await fetchBookByISBN(newBook.isbn);

      setNewBook((prev) => ({
        ...data,
        ...prev,
        read: prev.read ?? false,
        location_id: prev.location_id ?? undefined,
        date_added: prev.date_added ?? new Date().toISOString(),
      }));
    } catch (err) {
      console.error(err);
      alert("Book not found");
    } finally {
      setIsFetching(false);
    }
  }

  // ➕ ADD BOOK
  async function handleAddBook(category_ids: number[]) {
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
      category_ids, // 🔥 THIS WAS THE MISSING LINK
      date_added: new Date().toISOString(),
    };

    try {
      await addBook(payload);

      // ✅ clear form properly
      setNewBook({
        title: "",
        author: "",
        year: undefined,
        isbn: "",
        description: "",
        cover_url: "",
        location_id: undefined,
        read: false,
      });

      loadBooks();
    } catch (err) {
      console.error(err);
      alert("Failed to add book");
    }
  }

  // 🗑 DELETE
  async function handleDelete(id: number) {
    await removeBook(id);
    setSelectedBook(null);
    loadBooks();
  }

  // ✅ SAVE (FINAL FIX)
  async function handleSave(category_ids: number[]) {
    if (!editData) return;

    const updated = await saveBook({
      ...editData,
      category_ids,
    });

    // ✅ use fresh backend response
    setSelectedBook(updated);
    setEditData(updated);
    setEditing(false);
  }

  // 🔐 LOGIN SCREEN
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
      {/* HEADER */}
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

      {/* SETTINGS */}
      <SettingsModal
        isOpen={showSettings}
        apiKey={apiKey}
        onChange={setApiKey}
        onSave={saveSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* ADD + STATS */}
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

      {/* GRID */}
      <BookGrid
        books={books}
        onSelect={(book) => {
          setSelectedBook(book);
          setEditing(false);
        }}
      />

      {/* PANEL */}
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
