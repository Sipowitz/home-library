import client from "./client";

export async function getBooks(
  skip: number,
  limit: number,
  search?: string,
  locationId?: number | null,
) {
  const params = new URLSearchParams();

  params.append("skip", String(skip));
  params.append("limit", String(limit));

  // ✅ NEW — filters
  if (search) {
    params.append("search", search);
  }

  if (locationId) {
    params.append("location_id", String(locationId));
  }

  const res = await client.get(`/books?${params.toString()}`);
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

// ✅ preview only
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
