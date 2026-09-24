// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ReturnToShelfDialog } from "./ReturnToShelfDialog";
import { OutOfLibrary } from "./OutOfLibrary";

afterEach(cleanup);
const book = (id: number, position?: number) => ({ id, title: `Book ${id}`, author: `Author ${id}`, location_id: 1, cover_url: `/covers/${id}.png`, location_position: position });

it("hides an empty out area and opens compact out cards", () => {
  const onSelect = vi.fn();
  const view = render(<OutOfLibrary books={[]} onSelect={onSelect} />);
  expect(screen.queryByText("Out of Library")).toBeNull();
  view.rerender(<OutOfLibrary books={[book(3)]} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("button", { name: /Book 3/ }));
  expect(onSelect).toHaveBeenCalledWith(book(3));
});

it("shows two current neighbours on each side and no position for THIS BOOK", () => {
  const confirm = vi.fn(); const close = vi.fn();
  const preview = { book: book(3), location_id: 1, before: [book(1, 11), book(2, 12)], after: [book(4, 13), book(5, 14)] };
  const view = render(<ReturnToShelfDialog preview={preview} confirming={false} onClose={close} onConfirm={confirm} />);
  expect(screen.getByRole("dialog", { name: "Return to Shelf" }).className).toContain("z-[100]");
  expect(screen.getByText("THIS BOOK")).toBeTruthy();
  expect(screen.getByText("#11")).toBeTruthy();
  expect(screen.getByText("#14")).toBeTruthy();
  expect(screen.getByText("Book 3").closest("[data-placement-book]")?.textContent).not.toMatch(/#\d+/);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(close).toHaveBeenCalledOnce();
  expect(confirm).not.toHaveBeenCalled();
  view.rerender(<ReturnToShelfDialog preview={{ ...preview, before: [], after: [book(4, 1)] }} confirming={false} onClose={close} onConfirm={confirm} />);
  expect(screen.queryByText("#11")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirm Return" }));
  expect(confirm).toHaveBeenCalledOnce();
});
