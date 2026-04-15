import { useEffect, useState } from "react"
import { Book as BookIcon, LogOut, X } from "lucide-react"

import {
  getBooks,
  login,
  createBook,
  deleteBook,
  updateBook,
  fetchBookByISBN,
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
  cover_url?: string
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([])
  const [loggedIn, setLoggedIn] = useState(false)

  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const [newBook, setNewBook] = useState<Partial<Book>>({})
  const [showAddForm, setShowAddForm] = useState(false)

  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState<Book | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      setLoggedIn(true)
      loadBooks()
    }
  }, [])

  async function loadBooks() {
    const data = await getBooks()
    setBooks(data)
  }

  async function handleLogin() {
    try {
      await login(username, password)
      setLoggedIn(true)
      setError("")
      loadBooks()
    } catch {
      setError("Invalid login")
    }
  }

  function handleLogout() {
    localStorage.removeItem("token")
    setLoggedIn(false)
  }

  async function handleAddBook() {
    if (!newBook.title || !newBook.author) return
    await createBook(newBook)
    setNewBook({})
    setShowAddForm(false)
    loadBooks()
  }

  async function handleDelete(id: number) {
    await deleteBook(id)
    setSelectedBook(null)
    loadBooks()
  }

  async function handleSave() {
    if (!editData) return
    await updateBook(editData.id, editData)
    setSelectedBook(editData)
    setEditing(false)
    loadBooks()
  }

  async function handleISBNLookup(isbn: string) {
    try {
      const data = await fetchBookByISBN(isbn)
      setNewBook((prev) => ({ ...prev, ...data, isbn }))
    } catch {
      alert("Book not found")
    }
  }

  // ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedBook(null)
        setEditing(false)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div
      className="min-h-screen bg-gray-950 text-white p-4 md:p-6"
      onClick={() => {
        if (selectedBook) {
          setSelectedBook(null)
          setEditing(false)
        }
      }}
    >
      <div className="max-w-7xl mx-auto flex gap-6">

        {/* MAIN */}
        <div className="flex-1">

          {/* HEADER */}
          <div className="flex justify-between mb-6">
            <h1 className="text-2xl flex items-center gap-2">
              <BookIcon /> My Library
            </h1>
            {loggedIn && <button onClick={handleLogout}><LogOut /></button>}
          </div>

          {!loggedIn ? (
            <div className="max-w-sm mx-auto bg-gray-800 p-6 rounded">
              <input onChange={(e)=>setUsername(e.target.value)} className="w-full mb-2 p-2 bg-gray-700" placeholder="Username"/>
              <input type="password" onChange={(e)=>setPassword(e.target.value)} className="w-full mb-2 p-2 bg-gray-700" placeholder="Password"/>
              <button onClick={handleLogin} className="bg-blue-600 w-full p-2">Login</button>
              {error && <div>{error}</div>}
            </div>
          ) : (
            <>
              {/* ADD */}
              <div className="bg-gray-800 p-4 mb-6 rounded">
                {!showAddForm ? (
                  <button onClick={(e)=>{e.stopPropagation(); setShowAddForm(true)}} className="w-full bg-blue-600 py-2 rounded">
                    + Add Book
                  </button>
                ) : (
                  <div className="space-y-2" onClick={(e)=>e.stopPropagation()}>

                    <div className="flex gap-2">
                      <input
                        placeholder="ISBN"
                        className="p-2 bg-gray-700 w-full"
                        value={newBook.isbn || ""}
                        onChange={(e)=>setNewBook({...newBook,isbn:e.target.value})}
                      />
                      <button
                        onClick={()=>newBook.isbn && handleISBNLookup(newBook.isbn)}
                        className="bg-blue-600 px-3 rounded"
                      >
                        Search
                      </button>
                    </div>

                    <input placeholder="Title" className="p-2 bg-gray-700 w-full"
                      value={newBook.title || ""}
                      onChange={(e)=>setNewBook({...newBook,title:e.target.value})}
                    />

                    <input placeholder="Author" className="p-2 bg-gray-700 w-full"
                      value={newBook.author || ""}
                      onChange={(e)=>setNewBook({...newBook,author:e.target.value})}
                    />

                    <div className="flex gap-2">
                      <button onClick={handleAddBook} className="bg-green-600 flex-1 py-2 rounded">Add</button>
                      <button onClick={()=>setShowAddForm(false)} className="bg-gray-600 flex-1 py-2 rounded">Cancel</button>
                    </div>

                  </div>
                )}
              </div>

              {/* GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {books.map(book => (
                  <div
                    key={book.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedBook(book)
                      setEditing(false)
                    }}
                    className="cursor-pointer"
                  >
                    <div className="aspect-[2/3] bg-gray-800 rounded overflow-hidden">
                      <img
                        src={book.cover_url || "https://via.placeholder.com/300x400"}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="mt-2">
                      <div className="text-sm font-semibold">{book.title}</div>
                      <div className="text-xs text-gray-400">{book.author}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* PANEL */}
        {selectedBook && (
          <div
            className="hidden md:flex w-96 bg-gray-900 p-4 flex-col border-l border-gray-800 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={()=>setSelectedBook(null)} className="mb-2">
              <X />
            </button>

            <img src={selectedBook.cover_url || "https://via.placeholder.com/300x400"} className="w-32 mx-auto rounded"/>

            <h2 className="text-xl font-bold text-center mt-2">{selectedBook.title}</h2>
            <p className="text-gray-400 text-center">{selectedBook.author}</p>

            <div className="mt-4 space-y-1 text-sm">
              <div><b>Year:</b> {selectedBook.year}</div>
              <div><b>ISBN:</b> {selectedBook.isbn}</div>
              <div><b>Location:</b> {selectedBook.location}</div>
              <div><b>Status:</b> {selectedBook.read ? "Read" : "Unread"}</div>
            </div>

            <div className="mt-4">
              <b>Description</b>
              <p>{selectedBook.description}</p>
            </div>

            <div className="mt-auto">
              <button onClick={()=>handleDelete(selectedBook.id)} className="bg-red-600 w-full py-2">
                Delete
              </button>
            </div>
          </div>
        )}

        {/* MOBILE PANEL */}
        {selectedBook && (
          <div
            className="md:hidden fixed inset-0 bg-gray-900 z-50 p-4"
            onClick={(e)=>e.stopPropagation()}
          >
            <button onClick={()=>setSelectedBook(null)} className="mb-2">
              <X />
            </button>
            <img src={selectedBook.cover_url || "https://via.placeholder.com/300x400"} className="w-32 mx-auto rounded"/>
            <h2 className="text-xl text-center">{selectedBook.title}</h2>
          </div>
        )}

      </div>
    </div>
  )
}
