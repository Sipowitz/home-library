// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BookGridView } from "./BookGridView";

const book = { id: 1, title: "Loose Book", author: "Author" };
const group = { id: 2, owner_id: 1, name: "Naval History", node_type: "group" as const, author: null, description: null, cover_url: null, parent_id: null, created_at: "", updated_at: "" };
const nested = { ...group, id: 3, name: "Nested", node_type: "series" as const, parent_id: 2 };

it("keeps book selection and renders collection tiles with a cover-shaped placeholder", () => {
  const onBook = vi.fn(); const onCollection = vi.fn();
  render(<BookGridView books={[book]} collections={[group]} onSelect={onBook} onSelectCollection={onCollection} />);
  expect(screen.getAllByText("Group").length).toBeGreaterThan(0);
  const collectionTitle = screen.getAllByText("Naval History")[0];
  expect(collectionTitle).toBeTruthy();
  fireEvent.click(collectionTitle);
  expect(onCollection).toHaveBeenCalledWith(group);
  fireEvent.click(screen.getAllByText("Loose Book")[0]);
  expect(onBook).toHaveBeenCalledWith(book);
});

it("does not create nested collection tiles unless supplied by the browse API", () => {
  render(<BookGridView books={[]} collections={[group]} onSelect={vi.fn()} />);
  expect(screen.queryByText(nested.name)).toBeNull();
});

it("renders backend-supplied mixed root items without regrouping them", () => {
  const firstBook = { ...book, id: 10, title: "Adams Book" };
  const series = { ...group, id: 11, name: "Banks Series", node_type: "series" as const, author: "Iain Banks" };
  const lastBook = { ...book, id: 12, title: "Tolkien Book" };
  const { container } = render(<BookGridView books={[]} items={[
    { kind: "book", book: firstBook },
    { kind: "collection", collection: series },
    { kind: "book", book: lastBook },
  ]} onSelect={vi.fn()} onSelectCollection={vi.fn()} />);
  const labels = [...container.querySelectorAll(".mt-2 > div:first-child")].map((element) => element.textContent);
  expect(labels).toEqual(["Adams Book", "Banks Series", "Tolkien Book"]);
});
