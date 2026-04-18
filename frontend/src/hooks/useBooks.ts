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

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);

  // 📚 LOAD (🔥 FIX HERE)
  async function loadBooks() {
    const data = await getBooks();

    console.log("BOOKS FROM API:", data); // 🔍 DEBUG

    // ✅ ensure categories always exist
    const normalized = data.map((b: Book) => ({
      ...b,
      categories: b.categories || [],
      category_ids: b.categories?.map((c) => c.id) || [],
    }));

    setBooks(normalized);
  }

  // ➕ ADD
  async function addBook(newBook: Partial<Book>) {
    await createBook(newBook);
    await loadBooks();
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

    // update local state properly
    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

    return updated; // 🔥 KEY
  }

  return {
    books,
    loadBooks,
    addBook,
    removeBook,
    saveBook,
  };
}
