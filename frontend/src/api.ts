const API = "http://192.168.1.200:8000"

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

  if (!res.ok) throw new Error(data.detail || "Login failed")

  localStorage.setItem("token", data.access_token)
}


// 📚 GET BOOKS
export async function getBooks() {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API}/books`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) throw new Error("Unauthorized")

  return res.json()
}


// ➕ CREATE BOOK
export async function createBook(book: {
  title: string
  author: string
  year?: number
  isbn?: string
  description?: string
  read?: boolean
  location?: string
}) {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API}/books`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(book),
  })

  if (!res.ok) throw new Error("Failed to create book")

  return res.json()
}


// 🗑️ DELETE BOOK
export async function deleteBook(id: number) {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API}/books/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!res.ok) throw new Error("Failed to delete book")
}


// ✏️ UPDATE BOOK
export async function updateBook(
  id: number,
  book: {
    title?: string
    author?: string
    year?: number
    isbn?: string
    description?: string
    read?: boolean
    location?: string
  }
) {
  const token = localStorage.getItem("token")

  const res = await fetch(`${API}/books/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(book),
  })

  if (!res.ok) throw new Error("Failed to update book")

  return res.json()
}

// 📦 FETCH BOOK FROM ISBN (Open Library)
export async function fetchBookByISBN(isbn: string) {
  const res = await fetch(
    `https://openlibrary.org/isbn/${isbn}.json`
  )

  if (!res.ok) throw new Error("Book not found")

  const data = await res.json()

  return {
    title: data.title,
    author: data.by_statement || "",
    cover_url: data.covers
      ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
      : "",
  }
}
