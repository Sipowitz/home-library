import { useEffect, useState } from "react"
import {
  Book as BookIcon,
  Trash2,
  Pencil,
  LogOut,
  Plus,
  CheckCircle,
} from "lucide-react"

import {
  getBooks,
  login,
  createBook,
  deleteBook,
  updateBook,
} from "./api"

type Book = {
  id: number
  title: string
  author: string
  year?: number
  isbn?: string
  description?: string
  read?: boolean
  location?: string
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [loggedIn, setLoggedIn] = useState(false)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const [newTitle, setNewTitle] = useState("")
  const [newAuthor, setNewAuthor] = useState("")

  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [editingBook, setEditingBook] = useState<Book | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      setLoggedIn(true)
      loadBooks()
    }
  }, [])

  async function loadBooks() {
    try {
      const data = await getBooks()
      setBooks(data)
    } catch {
      setLoggedIn(false)
    }
  }

  async function handleLogin() {
    try {
      await login(username, password)
      setLoggedIn(true)
      setError("")
      loadBooks()
    } catch {
      setError("Invalid username or password")
    }
  }

  function handleLogout() {
    localStorage.removeItem("token")
    setLoggedIn(false)
    setBooks([])
  }

  async function handleAddBook() {
    if (!newTitle || !newAuthor) return
    await createBook({ title: newTitle, author: newAuthor })
    setNewTitle("")
    setNewAuthor("")
    loadBooks()
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this book?")) return
    await deleteBook(id)
    loadBooks()
  }

  async function handleSaveEdit() {
    if (!editingBook) return
    await updateBook(editingBook.id, editingBook)
    setEditingBook(null)
    loadBooks()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 text-white p-6">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <BookIcon className="w-8 h-8 text-blue-400" />
            My Library
          </h1>

          {loggedIn && (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition"
            >
              <LogOut size={16} />
              Logout
            </button>
          )}
        </div>

        {!loggedIn ? (
          <div className="max-w-sm mx-auto bg-gray-800 p-6 rounded-xl shadow-lg">
            <div className="flex flex-col gap-3">
              <input
                className="p-3 rounded bg-gray-700"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <input
                className="p-3 rounded bg-gray-700"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {error && <div className="text-red-400">{error}</div>}
              <button
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-700 p-3 rounded-lg font-semibold"
              >
                Login
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ADD BOOK */}
            <div className="bg-gray-800 p-5 rounded-xl mb-8 shadow">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Plus size={18} />
                Add New Book
              </h2>

              <div className="flex gap-2">
                <input
                  className="flex-1 p-2 bg-gray-700 rounded"
                  placeholder="Title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
                <input
                  className="flex-1 p-2 bg-gray-700 rounded"
                  placeholder="Author"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                />
                <button
                  onClick={handleAddBook}
                  className="bg-green-600 hover:bg-green-700 px-4 rounded flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            </div>

            {/* BOOK GRID */}
            {books.length === 0 ? (
              <div className="text-center text-gray-400">
                No books yet 📭
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="bg-gray-800 p-5 rounded-xl shadow hover:shadow-xl transition-all duration-200"
                  >
                    {/* HEADER */}
                    <div
                      className="flex justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedId(expandedId === book.id ? null : book.id)
                      }
                    >
                      <div>
                        <div className="font-semibold text-lg flex items-center gap-2">
                          {book.read && (
                            <CheckCircle className="text-green-400" size={16} />
                          )}
                          {book.title}
                        </div>
                        <div className="text-sm text-gray-400">
                          {book.author}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(book.id)
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* EXPANDED */}
                    {expandedId === book.id && (
                      <div className="mt-4 space-y-2 text-sm border-t border-gray-700 pt-3">
                        {editingBook?.id === book.id ? (
                          <>
                            <input
                              className="w-full p-2 bg-gray-700 rounded"
                              value={editingBook.title}
                              onChange={(e) =>
                                setEditingBook({ ...editingBook, title: e.target.value })
                              }
                            />
                            <input
                              className="w-full p-2 bg-gray-700 rounded"
                              value={editingBook.author}
                              onChange={(e) =>
                                setEditingBook({ ...editingBook, author: e.target.value })
                              }
                            />
                            <input
                              className="w-full p-2 bg-gray-700 rounded"
                              placeholder="Year"
                              value={editingBook.year || ""}
                              onChange={(e) =>
                                setEditingBook({ ...editingBook, year: Number(e.target.value) })
                              }
                            />

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={handleSaveEdit}
                                className="bg-green-600 px-3 py-1 rounded"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingBook(null)}
                                className="bg-gray-600 px-3 py-1 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>📅 {book.year || "Unknown year"}</div>
                            <div>📦 {book.isbn || "No ISBN"}</div>
                            <div>📍 {book.location || "No location"}</div>
                            <div className="text-gray-300">
                              {book.description || "No description"}
                            </div>

                            <button
                              onClick={() => setEditingBook(book)}
                              className="mt-2 flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 px-3 py-1 rounded"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
