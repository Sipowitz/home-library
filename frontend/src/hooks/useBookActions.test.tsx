// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const previewBookByISBN = vi.hoisted(() => vi.fn());

vi.mock("react-hot-toast", () => ({ default: toast }));
vi.mock("../context/CategoryContext", () => ({ useCategories: () => ({ reloadCategories: vi.fn() }) }));
vi.mock("../context/LocationContext", () => ({ useLocations: () => ({ reloadLocations: vi.fn() }) }));
vi.mock("../api/books", () => ({ previewBookByISBN }));
vi.mock("../api/providerResults", () => ({ fetchProviderResultsByISBN: vi.fn() }));

import { useBookActions } from "./useBookActions";
import type { BookDraft } from "../types/book";

afterEach(() => cleanup());

it("keeps the selected-book context and reports a failed delete without reconciling local state", async () => {
  const removeBook = vi.fn().mockRejectedValue(new Error("server failure"));
  const setSelectedBook = vi.fn();
  const reconcileDeletedBook = vi.fn();
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

  function Harness() {
    const { handleDelete } = useBookActions({
      newBook: {}, setNewBook: vi.fn(), addBook: vi.fn(), addBookFromISBN: vi.fn(),
      removeBook, saveBook: vi.fn(), setSelectedBook, setEditData: vi.fn(),
      setEditing: vi.fn(), editData: null, reconcileDeletedBook,
    });
    return <button onClick={() => void handleDelete(7)}>Delete successful</button>;
  }

  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Delete successful" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Book could not be deleted."));
  expect(removeBook).toHaveBeenCalledWith(7);
  expect(reconcileDeletedBook).not.toHaveBeenCalled();
  expect(setSelectedBook).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  error.mockRestore();
});

it("refreshes grouped results only after a successful delete", async () => {
  const reconcileGroupedBooks = vi.fn();
  function Harness() {
    const { handleDelete } = useBookActions({
      newBook: {}, setNewBook: vi.fn(), addBook: vi.fn(), addBookFromISBN: vi.fn(),
      removeBook: vi.fn().mockResolvedValue(undefined), saveBook: vi.fn(), setSelectedBook: vi.fn(), setEditData: vi.fn(),
      setEditing: vi.fn(), editData: null, reconcileGroupedBooks,
    });
    return <button onClick={() => void handleDelete(7)}>Delete</button>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(reconcileGroupedBooks).toHaveBeenCalledTimes(1));
});

it("refreshes grouped results after a successful edit so location and author changes are authoritative", async () => {
  const reconcileGroupedBooks = vi.fn();
  const edited = { id: 8, title: "Moved", author: "Zulu", read: false, location_id: null, category_id: null, isbn: "", description: "", cover_url: "", date_added: "2024-01-01" };
  function Harness() {
    const { handleSave } = useBookActions({
      newBook: {}, setNewBook: vi.fn(), addBook: vi.fn(), addBookFromISBN: vi.fn(), removeBook: vi.fn(),
      saveBook: vi.fn().mockResolvedValue(edited), setSelectedBook: vi.fn(), setEditData: vi.fn(), setEditing: vi.fn(),
      editData: edited, reconcileGroupedBooks,
    });
    return <button onClick={() => void handleSave()}>Save</button>;
  }
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(reconcileGroupedBooks).toHaveBeenCalledTimes(1));
});

it("saves an ISBN-bearing catalog candidate through normal creation after opening Book Edit", async () => {
  const addBook = vi.fn().mockResolvedValue({ id: 42, title: "Catalog book", author: "Author", isbn: "9780306406157" });
  const addBookFromISBN = vi.fn();

  function Harness() {
    const [newBook, setNewBook] = useState({});
    const [editData, setEditData] = useState<any>(null);
    const actions = useBookActions({
      newBook, setNewBook, addBook, addBookFromISBN, removeBook: vi.fn(), saveBook: vi.fn(),
      setSelectedBook: vi.fn(), setEditData, setEditing: vi.fn(), editData,
    });
    return <>
      <button onClick={() => actions.handleCatalogCandidateSelected({ title: "Catalog book", author: "Author", isbn: "9780306406157" })}>Select catalog</button>
      <button onClick={() => void actions.handleAddBook()}>Add to Library</button>
      <button onClick={() => void actions.handleSave()}>Save</button>
    </>;
  }

  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Select catalog" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to Library" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(addBook).toHaveBeenCalledWith(expect.objectContaining({ isbn: "9780306406157" })));
  expect(addBookFromISBN).not.toHaveBeenCalled();
});

it("opens Book Edit for an ISBN-less catalog candidate", async () => {
  const setEditing = vi.fn();
  const setEditData = vi.fn();
  function Harness() {
    const [newBook, setNewBook] = useState<BookDraft>({});
    const actions = useBookActions({
      newBook, setNewBook, addBook: vi.fn(), addBookFromISBN: vi.fn(), removeBook: vi.fn(), saveBook: vi.fn(),
      setSelectedBook: vi.fn(), setEditData, setEditing, editData: null,
    });
    return <><button onClick={() => actions.handleCatalogCandidateSelected({ title: "Older book", author: "Author", isbn: "" })}>Select ISBN-less catalog</button><button onClick={() => void actions.handleAddBook()}>Add to Library</button></>;
  }

  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Select ISBN-less catalog" }));
  fireEvent.click(screen.getByRole("button", { name: "Add to Library" }));
  expect(setEditing).toHaveBeenCalledWith(true);
  expect(setEditData).toHaveBeenCalledWith(expect.objectContaining({ isbn: "", title: "Older book" }));
});

it("keeps ISBN lookup drafts on the existing ISBN creation path", async () => {
  previewBookByISBN.mockResolvedValue({ title: "ISBN book", author: "Author", isbn: "9780306406157" });
  const addBookFromISBN = vi.fn().mockResolvedValue({ id: 43, title: "ISBN book", author: "Author" });

  function Harness() {
    const [newBook, setNewBook] = useState<BookDraft>({ isbn: "9780306406157" });
    const [editData, setEditData] = useState<any>(null);
    const actions = useBookActions({
      newBook, setNewBook, addBook: vi.fn(), addBookFromISBN, removeBook: vi.fn(), saveBook: vi.fn(),
      setSelectedBook: vi.fn(), setEditData, setEditing: vi.fn(), editData,
    });
    return <><button onClick={() => void actions.handleSearch()}>Search ISBN</button><button onClick={() => void actions.handleAddBook()}>Open edit</button><button onClick={() => void actions.handleSave()}>Save</button></>;
  }

  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Search ISBN" }));
  await waitFor(() => expect(previewBookByISBN).toHaveBeenCalled());
  fireEvent.click(screen.getByRole("button", { name: "Open edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(addBookFromISBN).toHaveBeenCalled());
});
