import { API, getAuthHeaders } from "./client";

// 📚 GET BOOKS
export async function getBooks() {
  const res = await fetch(`${API}/books`, {
    headers: getAuthHeaders(),
  });

  if (!res.ok) throw new Error("Unauthorized");
  return res.json();
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
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("CREATE ERROR:", text);
    throw new Error(text);
  }

  return res.json();
}

// 🗑 DELETE BOOK
export async function deleteBook(id: number) {
  const res = await fetch(`${API}/books/${id}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!res.ok) throw new Error("Delete failed");
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
  });

  if (!res.ok) throw new Error("Update failed");

  return res.json();
}
