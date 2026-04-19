import client from "./client";

// 📚 GET BOOKS (PAGINATED)
export async function getBooks(skip = 0, limit = 20) {
  const res = await client.get(`/books/?skip=${skip}&limit=${limit}`);
  return res.data;
}

// ➕ CREATE BOOK
export async function createBook(book: any) {
  const res = await client.post("/books/", book);
  return res.data;
}

// 🗑 DELETE BOOK
export async function deleteBook(id: number) {
  await client.delete(`/books/${id}`);
}

// ✏️ UPDATE BOOK
export async function updateBook(id: number, book: any) {
  const res = await client.put(`/books/${id}`, book);
  return res.data;
}
