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
  location?: string;
  cover_url?: string;
};

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);

  async function loadBooks() {
    const data = await getBooks();
    setBooks(data);
  }

  async function addBook(newBook: Partial<Book>) {
    await createBook({
      title: newBook.title!,
      author: newBook.author!,
    });
    await loadBooks();
  }

  async function removeBook(id: number) {
    await deleteBook(id);
    await loadBooks();
  }

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
