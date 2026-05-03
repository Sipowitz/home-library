import { useState } from "react";

import toast from "react-hot-toast";

import { previewBookByISBN } from "../api/books";

import { useCategories } from "../context/CategoryContext";

import type { Book, BookDraft } from "../types/book";

type Params = {
  newBook: BookDraft;

  setNewBook: (book: BookDraft | ((prev: any) => BookDraft)) => void;

  addBook: (b: any) => Promise<Book>;

  addBookFromISBN: (b: any) => Promise<Book>;

  removeBook: (id: number) => Promise<void>;

  saveBook: (b: Book) => Promise<Book>;

  setSelectedBook: (b: Book | null) => void;

  setEditData: (b: Book | null) => void;

  setEditing: (v: boolean) => void;

  editData: Book | null;
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
  editData,
}: Params) {
  const [isFetching, setIsFetching] = useState(false);

  const { reloadCategories } = useCategories();

  // -------------------
  // 🔍 ISBN SEARCH
  // -------------------

  async function handleSearch(overrideISBN?: string) {
    const isbn = overrideISBN || newBook.isbn;

    if (!isbn) return;

    try {
      setIsFetching(true);

      const data = await previewBookByISBN(isbn);

      setNewBook((prev: any) => ({
        ...data,
        ...prev,
        isbn,
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
  // ➕ OPEN DRAFT BOOK
  // -------------------

  async function handleAddBook() {
    if (!newBook.title || !newBook.author) return;

    const draftBook: Book = {
      id: 0,

      title: newBook.title,

      author: newBook.author,

      year: newBook.year ?? undefined,

      isbn: newBook.isbn ?? "",

      description: newBook.description ?? "",

      read: newBook.read ?? false,

      location_id: newBook.location_id ?? undefined,

      cover_url: newBook.cover_url ?? "",

      category_ids: [],

      date_added: new Date().toISOString(),
    };

    setSelectedBook(draftBook);

    setEditData(draftBook);

    setEditing(true);

    setNewBook({});
  }

  // -------------------
  // ❌ DELETE
  // -------------------

  async function handleDelete(id: number) {
    await removeBook(id);

    await reloadCategories();

    setSelectedBook(null);

    toast.success("Book deleted");
  }

  // -------------------
  // 💾 SAVE
  // -------------------

  async function handleSave(category_ids: number[]) {
    if (!editData) return;

    const payload: Book = {
      ...editData,
      category_ids,
    };

    // -------------------
    // 🆕 CREATE NEW BOOK
    // -------------------

    if (!payload.id) {
      try {
        const created = payload.isbn
          ? await addBookFromISBN(payload)
          : await addBook(payload);

        await reloadCategories();

        if (created.warning) {
          toast(created.warning);
        } else {
          toast.success("Book added");
        }

        setSelectedBook(created);

        setEditData(created);

        setEditing(false);

        return;
      } catch (err) {
        console.error("ADD ERROR:", err);

        toast.error("Failed to add book");

        return;
      }
    }

    // -------------------
    // ✏️ UPDATE EXISTING
    // -------------------

    const updated = await saveBook(payload);

    await reloadCategories();

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
