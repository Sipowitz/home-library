// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./BookGridView", () => ({
  BookGridView: ({ books, onSelect }: any) => <div data-testid="grid-books">{books.map((book: any) => <button key={book.id} onClick={() => onSelect(book)}>{book.title}</button>)}</div>,
}));
vi.mock("./BookListView", () => ({
  BookListView: ({ books, onSelect }: any) => <div data-testid="list-books">{books.map((book: any) => <button key={book.id} onClick={() => onSelect(book)}>{book.title}</button>)}</div>,
}));

import { GroupedLocationBooks } from "./GroupedLocationBooks";

const book = (id: number, title: string) => ({ id, title, author: "Author", read: false, location_id: null });
const grouped = {
  locations: [
    { id: 2, name: "Shelf H", books: [book(2, "Parent book")], children: [{ id: 3, name: "Shelf G", books: [book(3, "Nested book")], children: [] }] },
    { id: 1, name: "Room Divider", books: [book(1, "Root book")], children: [] },
  ],
  no_location: { name: "No Location" as const, books: [book(4, "Unlocated")] },
};

afterEach(cleanup);

it("renders the backend hierarchy and order, including direct parent books and No Location last", () => {
  render(<GroupedLocationBooks data={grouped} viewMode="grid" locations={[]} categories={[]} showCovers onSelect={vi.fn()} />);

  expect(Array.from(document.querySelectorAll("[data-location-group]")).map((node) => node.getAttribute("data-location-group"))).toEqual(["2", "3", "1", "no-location"]);
  expect(screen.getAllByTestId("grid-books")).toHaveLength(4);
  expect(screen.getByText("Parent book")).toBeTruthy();
  expect(screen.getByText("Nested book")).toBeTruthy();
  expect(screen.getByText("Unlocated")).toBeTruthy();
});

it("uses the existing list renderer and omits No Location when the API returns null", () => {
  const onSelect = vi.fn();
  render(<GroupedLocationBooks data={{ ...grouped, no_location: null }} viewMode="list" locations={[]} categories={[]} showCovers onSelect={onSelect} />);

  expect(screen.getAllByTestId("list-books")).toHaveLength(3);
  expect(screen.queryByText("No Location")).toBeNull();
  fireEvent.click(screen.getByText("Nested book"));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
});
