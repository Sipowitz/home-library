import client from "./client";

import type { Book } from "../types/book";

type PaginatedBooksResponse = {
  items: Book[];
  total: number;
};

type BookCreateInput = {
  title: string;
  author: string;

  year?: number;

  isbn?: string;

  description?: string;

  read?: boolean;

  location_id?: number | null;

  cover_url?: string;

  category_ids?: number[];
};

export async function getBooks(
  skip: number,
  limit: number,
  search?: string,
  locationId?: number | null,
): Promise<PaginatedBooksResponse> {
  const params = new URLSearchParams();

  params.append("skip", String(skip));

  params.append("limit", String(limit));

  if (search) {
    params.append("search", search);
  }

  if (locationId) {
    params.append("location_id", String(locationId));
  }

  // ✅ backend expects trailing slash
  const res = await client.get(`/books/?${params.toString()}`);

  return res.data;
}

export async function createBook(book: BookCreateInput): Promise<Book> {
  // ✅ backend expects trailing slash
  const res = await client.post("/books/", book);

  return res.data;
}

export async function createBookFromISBN(book: BookCreateInput): Promise<Book> {
  // ✅ backend expects NO trailing slash
  const res = await client.post("/books/from-isbn", book);

  return res.data;
}

export async function previewBookByISBN(isbn: string): Promise<Partial<Book>> {
  // ✅ backend expects NO trailing slash
  const res = await client.get(`/books/preview-isbn/${isbn}`);

  return res.data;
}

export async function updateBook(id: number, book: Book): Promise<Book> {
  // ✅ backend expects NO trailing slash
  const res = await client.put(`/books/${id}`, book);

  return res.data;
}

export async function deleteBook(id: number): Promise<void> {
  // ✅ backend expects NO trailing slash
  await client.delete(`/books/${id}`);
}
