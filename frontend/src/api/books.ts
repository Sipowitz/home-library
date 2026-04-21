import client from "./client";

export async function getBooks(skip: number, limit: number) {
  const res = await client.get(`/books?skip=${skip}&limit=${limit}`);
  return res.data;
}

export async function createBook(book: any) {
  const res = await client.post("/books", book);
  return res.data;
}

export async function createBookFromISBN(book: any) {
  const res = await client.post("/books/from-isbn", book);
  return res.data;
}

// ✅ NEW — preview only
export async function previewBookByISBN(isbn: string) {
  const res = await client.get(`/books/preview-isbn/${isbn}`);
  return res.data;
}

export async function updateBook(id: number, book: any) {
  const res = await client.put(`/books/${id}`, book);
  return res.data;
}

export async function deleteBook(id: number) {
  await client.delete(`/books/${id}`);
}
