// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../context/LocationContext", () => ({ useLocations: () => ({ locations: [] }) }));
vi.mock("../../context/CategoryContext", () => ({ useCategories: () => ({ categories: [] }) }));
vi.mock("../../hooks/useOverlayScrollLock", () => ({ useOverlayScrollLock: vi.fn() }));
vi.mock("./BookView", () => ({ BookView: () => null, resolveCoverUrl: () => null }));
vi.mock("./BookEdit", () => ({ BookEdit: ({ onDelete }: { onDelete: () => void }) => <button onClick={onDelete}>Delete Book</button> }));

import { BookPanel } from "./BookPanel";

afterEach(cleanup);

const book = { id: 9, title: "Visible confirmation", author: "Author", read: false } as any;

function renderPanel(onDelete = vi.fn().mockResolvedValue(undefined)) {
  return {
    onDelete,
    ...render(
      <BookPanel
        book={book}
        openedInCollection={false}
        editing
        editData={book}
        setEditing={vi.fn()}
        setEditData={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    ),
  };
}

it("shows a top-level confirmation over Book Edit and Cancel returns to editing", () => {
  renderPanel();
  fireEvent.click(screen.getByRole("button", { name: "Delete Book" }));

  expect(screen.getByRole("dialog", { name: "Delete Book?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog", { name: "Delete Book?" })).toBeNull();
  expect(screen.getByRole("button", { name: "Delete Book" })).toBeTruthy();
});

it("confirms once while pending and leaves a failed confirmation recoverable", async () => {
  let rejectDelete!: (error: Error) => void;
  const onDelete = vi.fn().mockReturnValue(new Promise<void>((_resolve, reject) => { rejectDelete = reject; }));
  renderPanel(onDelete);
  fireEvent.click(screen.getByRole("button", { name: "Delete Book" }));

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  fireEvent.click(screen.getByRole("button", { name: "Deleting..." }));
  expect(onDelete).toHaveBeenCalledTimes(1);

  rejectDelete(new Error("failed"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy());
  expect(screen.getByRole("dialog", { name: "Delete Book?" })).toBeTruthy();
});
