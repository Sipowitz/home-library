const API = "http://192.168.1.200:8000"

// 🔑 ENV KEY
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_BOOKS_API_KEY

// 🔐 LOGIN
export async function login(username: string, password: string) {
  const form = new URLSearchParams()
  form.append("username", username)
  form.append("password", password)

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  })

  const data = await res.json()

  if (!res.ok) {
    throw new Error(data.detail || "Login failed")
  }

  localStorage.setItem("token", data.access_token)
}

// 🔑 AUTH HEADER
function getAuthHeaders() {
  const token = localStorage.getItem("token")

  if (!token) {
    throw new Error("No auth token found")
  }

  return {
    Authorization: `Bearer ${token}`,
  }
}

// 📚 GET BOOKS
export async function getBooks() {
  const res = await fetch(`${API}/books`, {
    headers: getAuthHeaders(),
  })

  if (!res.ok) throw new Error("Unauthorized")
  return res.json()
}

// ➕ CREATE BOOK
export async function createBook(book: any) {
  const res = await fetch(`${API}/books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(book),
  })

  if (!res.ok) throw new Error("Failed to create book")
  return res.json()
}

// 🗑 DELETE BOOK
export async function deleteBook(id: number) {
  const res = await fetch(`${API}/books/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  })

  if (!res.ok) throw new Error("Failed to delete book")
}

// ✏️ UPDATE BOOK
export async function updateBook(id: number, book: any) {
  const res = await fetch(`${API}/books/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(book),
  })

  if (!res.ok) throw new Error("Failed to update book")
  return res.json()
}

// 🧠 CACHE (prevents repeated API hits)
const cache: Record<string, any> = {}

// 🔍 GOOGLE BOOKS LOOKUP (FINAL VERSION)
export async function fetchBookByISBN(rawIsbn: string) {
  const isbn = rawIsbn.replace(/[^0-9X]/gi, "")

  if (!isbn) throw new Error("Invalid ISBN")

  // ✅ Return cached result if exists
  if (cache[isbn]) return cache[isbn]

  // 1️⃣ ISBN search
  let res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${GOOGLE_API_KEY}`
  )

  let data = await res.json()

  // 2️⃣ fallback search
  if (!data.items || data.items.length === 0) {
    res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${isbn}&key=${GOOGLE_API_KEY}`
    )
    data = await res.json()
  }

  if (!data.items || data.items.length === 0) {
    throw new Error("Book not found")
  }

  const book = data.items[0].volumeInfo

  const result = {
    title: book.title || "",
    author: book.authors?.join(", ") || "",
    year: book.publishedDate
      ? Number(book.publishedDate.substring(0, 4))
      : undefined,
    description: book.description || "",
    isbn,
    cover_url:
      book.imageLinks?.thumbnail?.replace("http://", "https://") || "",
  }

  // ✅ Save to cache
  cache[isbn] = result

  return result
}
