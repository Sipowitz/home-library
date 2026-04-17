import { useState } from "react";
import { getBooks, createBook, deleteBook, updateBook } from "../api/books";

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
  category?: string;
  date_added?: string;
};

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);

  // 📚 LOAD
  async function loadBooks() {
    const data = await getBooks();
    setBooks(data);
  }

  // ➕ ADD (NOW SENDS FULL OBJECT)
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
    await updateBook(book.id, book);
    await loadBooks();
  }

  return {
    books,
    loadBooks,
    addBook,
    removeBook,
    saveBook,
  };
}
