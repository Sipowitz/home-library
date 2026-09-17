// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BookGridView } from "./BookGridView";

const book = { id: 1, title: "Loose Book", author: "Author" };
const group = { id: 2, owner_id: 1, name: "Naval History", node_type: "group" as const, author: null, description: null, cover_url: null, parent_id: null, created_at: "", updated_at: "" };
const series = { ...group, id: 3, name: "Discworld", node_type: "series" as const, author: "Terry Pratchett" };
const nested = { ...series, id: 4, name: "Nested", parent_id: 2 };

it("renders Groups and Series with the same no-cover Collection artwork and no type labels", () => {
  const { container } = render(<BookGridView books={[]} collections={[group, series]} onSelect={vi.fn()} onSelectCollection={vi.fn()} />);
  expect(container.querySelectorAll('[data-testid="collection-placeholder-artwork"]')).toHaveLength(2);
  expect(container.querySelectorAll('[aria-label="Collection"]')).toHaveLength(0);
  expect(screen.getByRole("button", { name: "Open collection: Naval History" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Open collection: Discworld" })).toBeTruthy();
  expect(screen.queryByText("Group")).toBeNull();
  expect(screen.queryByText("Series")).toBeNull();
});

it("renders collection covers, placeholder metadata, and collection selection", () => {
  const onCollection = vi.fn();
  const covered = { ...series, cover_url: "/covers/objects/sha256/ab/cover.jpg" };
  const { container } = render(<BookGridView books={[book]} collections={[covered, group]} onSelect={vi.fn()} onSelectCollection={onCollection} />);
  expect(container.querySelector('img[src="/covers/objects/sha256/ab/cover.jpg"]')).toBeTruthy();
  const coveredButton = screen.getAllByRole("button", { name: "Open collection: Discworld" }).at(-1)!;
  expect(coveredButton.textContent).toContain("Terry Pratchett");
  expect(coveredButton.querySelector('[aria-label="Collection"]')).toBeTruthy();
  const groupButton = screen.getAllByRole("button", { name: "Open collection: Naval History" }).at(-1)!;
  expect(groupButton.textContent).not.toContain("Terry Pratchett");
  expect(groupButton.querySelector('[aria-label="Collection"]')).toBeNull();
  expect(groupButton.querySelector('[data-testid="collection-placeholder-artwork"]')).toBeTruthy();
  fireEvent.click(groupButton);
  expect(onCollection).toHaveBeenCalledWith(group);
});

it("falls back to the intentional collection placeholder when a cover fails", () => {
  const covered = { ...series, cover_url: "/covers/objects/sha256/ab/missing.jpg" };
  const { container } = render(<BookGridView books={[]} collections={[covered]} onSelect={vi.fn()} onSelectCollection={vi.fn()} />);
  const cover = container.querySelector('img[src="/covers/objects/sha256/ab/missing.jpg"]');
  expect(cover).toBeTruthy();
  fireEvent.error(cover!);
  expect(container.querySelector('img[src="/covers/objects/sha256/ab/missing.jpg"]')).toBeNull();
  expect(container.querySelector('[aria-label="Collection"]')).toBeNull();
  expect(container.querySelector('[data-testid="collection-placeholder-artwork"]')).toBeTruthy();
  expect(screen.getAllByText("Discworld").length).toBeGreaterThan(1);
  expect(screen.getAllByText("Terry Pratchett").length).toBeGreaterThan(1);
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
