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

const LIMIT = 20;

export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // 📚 INITIAL LOAD
  async function loadBooks() {
    const data = await getBooks(0, LIMIT);

    setBooks(data.items);
    setSkip(LIMIT);
    setHasMore(data.items.length < data.total);
  }

  // 📚 LOAD MORE (for infinite scroll)
  async function loadMoreBooks() {
    if (!hasMore) return;

    const data = await getBooks(skip, LIMIT);

    setBooks((prev) => [...prev, ...data.items]);
    setSkip((prev) => prev + LIMIT);
    setHasMore(skip + LIMIT < data.total);
  }

  // ➕ ADD
  async function addBook(book: any) {
    const data = await createBook(book);

    setBooks((prev) => [data, ...prev]);

    return data;
  }

  // 🗑 DELETE
  async function removeBook(id: number) {
    await deleteBook(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }

  // ✏️ UPDATE
  async function saveBook(book: Book) {
    const updated = await updateBook(book.id, book);

    setBooks((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));

    return updated;
  }

  return {
    books,
    loadBooks,
    loadMoreBooks,
    hasMore,
    addBook,
    removeBook,
    saveBook,
  };
}
