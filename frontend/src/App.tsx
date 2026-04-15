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

  const [isFetching, setIsFetching] = useState(false)
  const [fetched, setFetched] = useState(false)

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

  async function handleISBNLookup(isbn: string) {
    try {
      setIsFetching(true)
      const data = await fetchBookByISBN(isbn)

      setNewBook((prev) => ({
        ...prev,
        ...data,
        isbn,
      }))

      setFetched(true)
    } catch {
      alert("Book not found")
    } finally {
      setIsFetching(false)
    }
  }

  async function handleAddBook() {
    if (!newBook.title || !newBook.author) {
      alert("Missing title or author")
      return
    }

    await createBook(newBook)

    setNewBook({})
    setFetched(false)
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

  // ESC
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
                        onChange={(e)=>{setNewBook({...newBook,isbn:e.target.value}); setFetched(false)}}
                      />
                      <button onClick={()=>newBook.isbn && handleISBNLookup(newBook.isbn)} className="bg-blue-600 px-3 rounded">
                        {isFetching ? "..." : "Search"}
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

                    {fetched && <div className="text-green-400 text-sm">✓ Book data loaded</div>}

                    <div className="flex gap-2">
                      <button onClick={handleAddBook} className="bg-green-600 flex-1 py-2 rounded">Add</button>
                      <button onClick={()=>{setShowAddForm(false); setNewBook({}); setFetched(false)}} className="bg-gray-600 flex-1 py-2 rounded">Cancel</button>
                    </div>

                  </div>
                )}
              </div>

              {/* GRID */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {books.map(book => (
                  <div
                    key={book.id}
                    onClick={(e)=>{e.stopPropagation(); setSelectedBook(book); setEditing(false)}}
                    className="cursor-pointer"
                  >
                    <div className="aspect-[2/3] bg-gray-800 rounded overflow-hidden">
                      <img src={book.cover_url || "https://via.placeholder.com/300x400"} className="w-full h-full object-cover"/>
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
          <div className="hidden md:flex w-96 bg-gray-900 p-4 flex-col border-l border-gray-800 rounded-xl shadow-2xl" onClick={(e)=>e.stopPropagation()}>

            <button onClick={()=>setSelectedBook(null)} className="mb-2">
              <X />
            </button>

            {/* COVER */}
            <img
              src={(editing ? editData?.cover_url : selectedBook.cover_url) || "https://via.placeholder.com/300x400"}
              className="w-32 mx-auto rounded"
            />

            {!editing ? (
              <>
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

                <button
                  onClick={() => {
                    setEditing(true)
                    setEditData(selectedBook)
                  }}
                  className="mt-4 bg-yellow-600 py-2 rounded"
                >
                  Edit
                </button>
              </>
            ) : (
              <div className="space-y-3 mt-4 text-sm">

                <label>Title</label>
                <input className="w-full p-2 bg-gray-700 rounded"
                  value={editData?.title || ""}
                  onChange={(e)=>setEditData({...editData!,title:e.target.value})}
                />

                <label>Author</label>
                <input className="w-full p-2 bg-gray-700 rounded"
                  value={editData?.author || ""}
                  onChange={(e)=>setEditData({...editData!,author:e.target.value})}
                />

                <label>Year</label>
                <input className="w-full p-2 bg-gray-700 rounded"
                  value={editData?.year || ""}
                  onChange={(e)=>setEditData({...editData!,year:Number(e.target.value)})}
                />

                <label>ISBN</label>
                <input className="w-full p-2 bg-gray-700 rounded"
                  value={editData?.isbn || ""}
                  onChange={(e)=>setEditData({...editData!,isbn:e.target.value})}
                />

                <label>Location</label>
                <input className="w-full p-2 bg-gray-700 rounded"
                  value={editData?.location || ""}
                  onChange={(e)=>setEditData({...editData!,location:e.target.value})}
                />

                <label>Description</label>
                <textarea className="w-full p-2 bg-gray-700 rounded"
                  value={editData?.description || ""}
                  onChange={(e)=>setEditData({...editData!,description:e.target.value})}
                />

                <label>Cover URL</label>
                <input className="w-full p-2 bg-gray-700 rounded"
                  value={editData?.cover_url || ""}
                  onChange={(e)=>setEditData({...editData!,cover_url:e.target.value})}
                />

                {/* READ TOGGLE */}
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editData?.read || false}
                    onChange={(e)=>setEditData({...editData!,read:e.target.checked})}
                  />
                  Mark as read
                </label>

                <div className="flex gap-2 pt-3">
                  <button onClick={handleSave} className="bg-green-600 flex-1 py-2 rounded">Save</button>
                  <button onClick={()=>setEditing(false)} className="bg-gray-600 flex-1 py-2 rounded">Cancel</button>
                </div>

              </div>
            )}

            {!editing && (
              <button onClick={()=>handleDelete(selectedBook.id)} className="mt-auto bg-red-600 py-2 rounded">
                Delete
              </button>
            )}

          </div>
        )}

      </div>
    </div>
  )
}
