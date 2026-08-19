import { useState } from "react";

import toast from "react-hot-toast";

import { previewBookByISBN } from "../api/books";

import { fetchProviderResultsByISBN } from "../api/providerResults";

import { useCategories } from "../context/CategoryContext";

import type { Book, BookDraft } from "../types/book";

import type { ProviderResult } from "../types/provider";

type Params = {
  newBook: BookDraft;

  setNewBook: (book: BookDraft | ((prev: any) => BookDraft)) => void;

  addBook: (b: any) => Promise<Book>;

  addBookFromISBN: (payload: {
    book: any;

    provider_results: ProviderResult[];
  }) => Promise<Book>;

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

  // -------------------
  // 📦 TRANSIENT PROVIDER EVIDENCE
  // -------------------

  const [providerResults, setProviderResults] = useState<ProviderResult[]>([]);

  const { reloadCategories } = useCategories();

  // -------------------
  // 🔍 ISBN SEARCH
  // -------------------

  async function handleSearch(overrideISBN?: string) {
    const isbn = overrideISBN || newBook.isbn;

    if (!isbn) return;

    try {
      setIsFetching(true);

      // -------------------
      // 📚 PREVIEW DATA
      // -------------------

      const data = await previewBookByISBN(isbn);

      // -------------------
      // 📦 PROVIDER RESULTS
      // -------------------

      try {
        const providerData = await fetchProviderResultsByISBN(isbn);

        setProviderResults(providerData);
      } catch (err) {
        console.error("Failed to load provider results:", err);

        setProviderResults([]);
      }

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

      subtitle: newBook.subtitle ?? undefined,

      publisher: newBook.publisher ?? undefined,

      language: newBook.language ?? undefined,

      page_count: newBook.page_count ?? undefined,

      year: newBook.year ?? undefined,

      isbn: newBook.isbn ?? "",

      description: newBook.description ?? "",

      read: newBook.read ?? false,

      location_id: newBook.location_id ?? null,

      cover_url: newBook.cover_url ?? "",

      category_id: null,

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

  async function handleSave() {
    if (!editData) return;

    const payload = {
      ...editData,
    };

    delete (payload as any).warning;

    // -------------------
    // 🆕 CREATE NEW BOOK
    // -------------------

    if (!payload.id) {
      try {
        delete (payload as any).id;
        delete (payload as any).date_added;
        delete (payload as any).last_metadata_refresh_at;
        delete (payload as any).category;

        const created = payload.isbn
          ? await addBookFromISBN({
              book: payload,

              provider_results: providerResults,
            })
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

        // -------------------
        // 🧹 RESET EVIDENCE
        // -------------------

        setProviderResults([]);

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

    const updated = await saveBook(payload as Book);

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
