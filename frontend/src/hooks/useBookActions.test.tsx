// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("react-hot-toast", () => ({ default: toast }));
vi.mock("../context/CategoryContext", () => ({ useCategories: () => ({ reloadCategories: vi.fn() }) }));
vi.mock("../context/LocationContext", () => ({ useLocations: () => ({ reloadLocations: vi.fn() }) }));
vi.mock("../api/books", () => ({ previewBookByISBN: vi.fn() }));
vi.mock("../api/providerResults", () => ({ fetchProviderResultsByISBN: vi.fn() }));

import { useBookActions } from "./useBookActions";

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
    return <button onClick={() => void handleDelete(7)}>Delete</button>;
  }

  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));

  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Book could not be deleted."));
  expect(removeBook).toHaveBeenCalledWith(7);
  expect(reconcileDeletedBook).not.toHaveBeenCalled();
  expect(setSelectedBook).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  error.mockRestore();
});
