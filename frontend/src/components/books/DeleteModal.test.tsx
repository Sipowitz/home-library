// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { DeleteModal } from "./DeleteModal";

afterEach(cleanup);

it("awaits a rejected delete action without an unhandled rejection or closing context", async () => {
  const onDelete = vi.fn().mockRejectedValue(new Error("delete failed"));
  render(<DeleteModal open book={{ id: 1, title: "Retry me" }} hasCollections openedInCollection={false} onClose={vi.fn()} onDelete={onDelete} />);

  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  expect(screen.getByRole("button", { name: "Deleting..." })).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "Delete" })).toBeTruthy());

  expect(onDelete).toHaveBeenCalledWith(1);
  expect(document.querySelector("strong")?.textContent).toBe("“Retry me”");
  expect(screen.getByRole("dialog", { name: "Delete Book?" })).toBeTruthy();
  expect(screen.getByText("This will also remove it from any Collections it belongs to.")).toBeTruthy();
});

it("only shows the Collection warning when memberships are present", () => {
  render(<DeleteModal open book={{ id: 2, title: "Standalone" }} hasCollections={false} openedInCollection={false} onClose={vi.fn()} onDelete={vi.fn()} />);

  expect(document.querySelector("strong")?.textContent).toBe("“Standalone”");
  expect(screen.getByText(/Permanently delete/)).toBeTruthy();
  expect(screen.queryByText("This will also remove it from any Collections it belongs to.")).toBeNull();
  expect(screen.queryByRole("button", { name: /remove from collection/i })).toBeNull();
});

it("uses Library-not-Collection wording only when opened inside a Collection", () => {
  render(<DeleteModal open book={{ id: 3, title: "Collection view" }} hasCollections openedInCollection onClose={vi.fn()} onDelete={vi.fn()} />);

  expect(screen.getByText("This will delete the book from your Library, not just remove it from this Collection.")).toBeTruthy();
  expect(screen.queryByText("This will also remove it from any Collections it belongs to.")).toBeNull();
});
