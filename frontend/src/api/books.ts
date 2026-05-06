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

  // ✅ required now
  category_ids: number[];
};

type BookUpdateInput = {
  title?: string;
  author?: string;
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
  categoryId?: number | null,
  read?: boolean,
): Promise<PaginatedBooksResponse> {
  const params = new URLSearchParams();

  params.append("skip", String(skip));
  params.append("limit", String(limit));

  if (search) {
    params.append("search", search);
  }

  if (locationId !== undefined && locationId !== null) {
    params.append("location_id", String(locationId));
  }

  if (categoryId !== undefined && categoryId !== null) {
    params.append("category_id", String(categoryId));
  }

  if (read !== undefined) {
    params.append("read", String(read));
  }

  const res = await client.get(`/books/?${params.toString()}`);

  return res.data;
}

export async function createBook(book: BookCreateInput): Promise<Book> {
  const payload = {
    ...book,
    category_ids: book.category_ids ?? [],
  };

  const res = await client.post("/books/", payload);

  return res.data;
}

export async function createBookFromISBN(book: BookCreateInput): Promise<Book> {
  const payload = {
    ...book,
    category_ids: book.category_ids ?? [],
  };

  const res = await client.post("/books/from-isbn", payload);

  return res.data;
}

export async function previewBookByISBN(isbn: string): Promise<Partial<Book>> {
  const res = await client.get(`/books/preview-isbn/${isbn}`);

  return res.data;
}

export async function updateBook(
  id: number,
  book: BookUpdateInput,
): Promise<Book> {
  const payload = {
    ...book,
    ...(book.category_ids && { category_ids: book.category_ids }),
  };

  const res = await client.put(`/books/${id}`, payload);

  return res.data;
}

export async function deleteBook(id: number): Promise<void> {
  await client.delete(`/books/${id}`);
}
