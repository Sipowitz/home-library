import { useState } from "react";
import { previewBookByISBN } from "../api/books";
import toast from "react-hot-toast";

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
  warning?: string;
};

type Params = {
  newBook: Partial<Book>;
  setNewBook: (b: Partial<Book>) => void;

  addBook: (b: any) => Promise<Book>;
  addBookFromISBN: (b: any) => Promise<Book>;
  removeBook: (id: number) => Promise<void>;
  saveBook: (b: Book) => Promise<Book>;

  setSelectedBook: (b: Book | null) => void;
  setEditData: (b: Book | null) => void;
  setEditing: (v: boolean) => void;
};

export function useBookActions({
  newBook,
  setNewBook,
  addBook,
  addBookFromISBN,
  removeBook,
  saveBook,
  setSelectedBook,
  setEditData,
  setEditing,
}: Params) {
  const [isFetching, setIsFetching] = useState(false);

  // -------------------
  // 🔍 ISBN SEARCH
  // -------------------
  async function handleSearch() {
    if (!newBook.isbn) return;

    try {
      setIsFetching(true);

      const data = await previewBookByISBN(newBook.isbn);

      setNewBook((prev) => ({
        ...data,
        ...prev,
        read: prev.read ?? false,
        date_added: prev.date_added ?? new Date().toISOString(),
      }));

      toast.success("Book found");
    } catch (err) {
      console.error(err);
      toast.error("Book not found");
    } finally {
      setIsFetching(false);
    }
  }

  // -------------------
  // ➕ ADD BOOK
  // -------------------
  async function handleAddBook() {
    if (!newBook.title || !newBook.author) return;

    const payload = {
      title: newBook.title,
      author: newBook.author,
      year: newBook.year ?? null,
      isbn: newBook.isbn ?? "",
      description: newBook.description ?? "",
      read: newBook.read ?? false,
      location_id: newBook.location_id ?? null,
      cover_url: newBook.cover_url ?? "",
      category_ids: [],
      date_added: new Date().toISOString(),
    };

    try {
      const created = payload.isbn
        ? await addBookFromISBN(payload)
        : await addBook(payload);

      if (created.warning) {
        toast(created.warning);
      } else {
        toast.success("Book added");
      }

      setSelectedBook(created);
      setEditData(created);
      setEditing(true);

      setNewBook({});
    } catch (err) {
      console.error("ADD ERROR:", err);
      toast.error("Failed to add book");
    }
  }

  // -------------------
  // ❌ DELETE
  // -------------------
  async function handleDelete(id: number) {
    await removeBook(id);
    setSelectedBook(null);
    toast.success("Book deleted");
  }

  // -------------------
  // 💾 SAVE
  // -------------------
  async function handleSave(category_ids: number[]) {
    const updated = await saveBook({
      ...newBook,
      category_ids,
    } as Book);

    setSelectedBook(updated);
    setEditData(updated);
    setEditing(false);

    toast.success("Book updated");
  }

  return {
    isFetching,
    handleSearch,
    handleAddBook,
    handleDelete,
    handleSave,
  };
}
