import { useEffect, useState } from "react"
import { getBooks, login, createBook, deleteBook } from "./api"

type Book = {
  id: number
  title: string
  author: string
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [loggedIn, setLoggedIn] = useState(false)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const [newTitle, setNewTitle] = useState("")
  const [newAuthor, setNewAuthor] = useState("")

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

    try {
      await createBook({
        title: newTitle,
        author: newAuthor,
      })

      setNewTitle("")
      setNewAuthor("")
      loadBooks()
    } catch {
      alert("Failed to add book")
    }
  }

  async function handleDelete(id: number) {
  try {
    await deleteBook(id)
    loadBooks()
  } catch {
    alert("Failed to delete book")
  }
}

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-800 p-6 rounded-2xl shadow-lg">
        <h1 className="text-3xl font-bold mb-6 text-center">
          📚 My Library
        </h1>

        {!loggedIn ? (
          <>
            {/* LOGIN */}
            <div className="flex flex-col gap-3">
              <input
                className="p-2 rounded bg-gray-700 border border-gray-600"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <input
                className="p-2 rounded bg-gray-700 border border-gray-600"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              {error && (
                <div className="text-red-400 text-sm">{error}</div>
              )}

              <button
                onClick={handleLogin}
                className="bg-blue-600 hover:bg-blue-700 p-2 rounded font-semibold"
              >
                Login
              </button>
            </div>
          </>
        ) : (
          <>
            {/* BOOK LIST */}
            {books.length === 0 ? (
              <div className="text-center text-gray-400 mb-4">
                <p>No books yet 📭</p>
                <p className="text-sm">Add your first book below 👇</p>
              </div>
            ) : (
              <div className="space-y-3 mb-4">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className="bg-gray-700 p-3 rounded-lg"
                  >
                    <div className="font-semibold">{book.title}</div>
                    <div className="text-sm text-gray-300">
                      {book.author}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ADD BOOK */}
            <div className="flex flex-col gap-2">
              <input
                className="p-2 rounded bg-gray-700 border border-gray-600"
                placeholder="Book title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />

              <input
                className="p-2 rounded bg-gray-700 border border-gray-600"
                placeholder="Author"
                value={newAuthor}
                onChange={(e) => setNewAuthor(e.target.value)}
              />

              <button
                onClick={handleAddBook}
                className="bg-green-600 hover:bg-green-700 p-2 rounded font-semibold"
              >
                Add Book
              </button>
            </div>

            {/* LOGOUT */}
            <button
              onClick={handleLogout}
              className="mt-6 w-full bg-gray-600 hover:bg-gray-700 p-2 rounded"
            >
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  )
}
