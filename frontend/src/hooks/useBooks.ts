import { useState } from "react";
import { getBooks, createBook, deleteBook, updateBook } from "../api/books";

type Category = {
  id: number;
  name: string;
};

type Book = {
  id: number;
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  description?: string;
  read?: boolean;
  location_id?: number;
  cover_url?: string;
  categories?: Category[];
  category_ids?: number[];
  date_added?: string;
};

// 🔥 API BASE (CHANGE IF NEEDED)
const API = "http://192.168.1.200:8000";

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);

  // 📚 LOAD
  async function loadBooks() {
    const data = await getBooks();

    console.log("BOOKS FROM API:", data);

    const normalized = data.map((b: Book) => ({
      ...b,
      categories: b.categories || [],
      category_ids: b.categories?.map((c) => c.id) || [],
    }));

    setBooks(normalized);
  }

  // ➕ ADD (🔥 FIXED URL)
  async function addBook(book: any) {
    const res = await fetch(`${API}/books/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(book),
    });

    if (!res.ok) {
      throw new Error("Failed to add book");
    }

    const data = await res.json();
    console.log("CREATED BOOK:", data);

    return data;
  }

  // 🗑 DELETE
  async function removeBook(id: number) {
    await deleteBook(id);
    await loadBooks();
  }

  // ✏️ UPDATE
  async function saveBook(book: Book) {
    const payload = {
      ...book,
      category_ids: book.category_ids || [],
    };

    const updated = await updateBook(book.id, payload);

    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

    return updated;
  }

  return {
    books,
    loadBooks,
    addBook,
    removeBook,
    saveBook,
  };
}
