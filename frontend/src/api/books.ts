import client from "./client";

import type { Book } from "../types/book";

import type { ProviderResult } from "../types/provider";

type PaginatedBooksResponse = {
  items: Book[];
  total: number;
};

type BookCreateInput = {
  title: string;

  author: string;

  subtitle?: string;

  publisher?: string;

  language?: string;

  page_count?: number;

  year?: number;

  isbn?: string;

  description?: string;

  read?: boolean;

  location_id?: number | null;

  cover_url?: string;

  category_id?: number | null;
};

type BookUpdateInput = {
  title?: string;

  author?: string;

  subtitle?: string;

  publisher?: string;

  language?: string;

  page_count?: number;

  year?: number;

  isbn?: string;

  description?: string;

  read?: boolean;

  location_id?: number | null;

  cover_url?: string;

  category_id?: number | null;

  mark_metadata_reviewed?: boolean;
  mark_cover_reviewed?: boolean;
};

type CreateBookFromISBNPayload = {
  book: BookCreateInput;

  provider_results: ProviderResult[];

  allow_duplicate?: boolean;
};

export type CoverCandidate = {
  provider: string;

  label: string;

  url: string;
};

export type ReviewIntent = {
  mark_metadata_reviewed?: boolean;
  mark_cover_reviewed?: boolean;
};

export type LibraryCheckMatch = {
  classification: "exact" | "likely" | "possible";
  score: number;
  book: Book;
};

export type LibraryCheckResponse = {
  normalized_isbn?: string | null;
  exact_matches: LibraryCheckMatch[];
  likely_matches: LibraryCheckMatch[];
  possible_matches: LibraryCheckMatch[];
};

export type CoverCandidatesResponse = {
  candidates: CoverCandidate[];
  cover_review: import("../types/book").ReviewStatus;
};

export type CoverRefreshResponse = CoverCandidatesResponse & {
  provider_results: ProviderResult[];
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

export async function getBook(id: number): Promise<Book> {
  const res = await client.get(`/books/${id}`);

  return res.data;
}

export async function checkLibrary(params: { isbn?: string; title?: string; author?: string }): Promise<LibraryCheckResponse> {
  const res = await client.get("/books/check-library", { params });
  return res.data;
}

export async function createBook(book: BookCreateInput): Promise<Book> {
  const res = await client.post("/books/", book);

  return res.data;
}

export async function createBookFromISBN(
  payload: CreateBookFromISBNPayload,
): Promise<Book> {
  const res = await client.post("/books/from-isbn", payload);

  return res.data;
}

export async function previewBookByISBN(isbn: string): Promise<Partial<Book>> {
  const res = await client.get(`/books/preview-isbn/${isbn}`);

  return res.data;
}

export async function refreshMetadata(
  bookId: number,
): Promise<ProviderResult[]> {
  const res = await client.post(`/books/${bookId}/refresh-metadata`);

  return res.data;
}

export async function getCoverCandidates(bookId: number): Promise<CoverCandidatesResponse> {
  const res = await client.get(`/books/${bookId}/cover-candidates`);
  return res.data;
}

export async function refreshCovers(bookId: number): Promise<CoverRefreshResponse> {
  const res = await client.post(`/books/${bookId}/refresh-covers`);
  return res.data;
}

export async function updateBook(
  id: number,
  book: BookUpdateInput,
): Promise<Book> {
  const res = await client.put(`/books/${id}`, book);

  return res.data;
}

export async function uploadCover(
  bookId: number,
  file: File,
): Promise<CoverCandidate> {
  const formData = new FormData();

  formData.append("file", file);

  const res = await client.post(`/books/${bookId}/upload-cover`, formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return res.data;
}

export async function deleteBook(id: number): Promise<void> {
  await client.delete(`/books/${id}`);
}
