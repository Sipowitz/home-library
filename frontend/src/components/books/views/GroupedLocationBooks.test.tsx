// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./BookGridView", () => ({
  BookGridView: ({ books, onSelect, suggestedBookIds, suggestedLocationsByBookId, onSuggestedSelect }: any) => <div data-testid="grid-books">{books.map((book: any) => <button data-testid={`grid-book-${book.id}`} data-suggested-book={suggestedBookIds?.has(book.id) || undefined} key={book.id} onClick={() => { if (suggestedBookIds?.has(book.id)) onSuggestedSelect?.(book, suggestedLocationsByBookId?.get(book.id)); else onSelect(book); }}>{book.title}{suggestedBookIds?.has(book.id) && " Suggested"}</button>)}</div>,
}));
vi.mock("./BookListView", () => ({
  BookListView: ({ books, onSelect, suggestedBookIds, suggestedLocationsByBookId, onSuggestedSelect }: any) => <div data-testid="list-books">{books.map((book: any) => <button data-suggested-book={suggestedBookIds?.has(book.id) || undefined} key={book.id} onClick={() => { if (suggestedBookIds?.has(book.id)) onSuggestedSelect?.(book, suggestedLocationsByBookId?.get(book.id)); else onSelect(book); }}>{book.title}{suggestedBookIds?.has(book.id) && " Suggested"}</button>)}</div>,
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

it("derives inert, alphabetically interleaved copies by Location id while retaining normal No Location books", () => {
  const onSelect = vi.fn();
  const suggestedOne = { ...book(10, "Suggested A"), author: "Alice Able", suggested_locations: [{ id: 1, name: "Same name", path: [] }, { id: 2, name: "Nested", path: [] }] };
  const suggestedTwo = { ...book(11, "Suggested C"), author: "Chris Clark", suggested_locations: [{ id: 1, name: "Same name", path: [] }] };
  const data = {
    locations: [
      { id: 1, name: "Same name", books: [{ ...book(1, "Assigned B"), author: "Bob Brown" }], children: [{ id: 2, name: "Nested", books: [], children: [] }] },
      { id: 3, name: "Same name", books: [{ ...book(3, "Assigned D"), author: "Dan Delta" }], children: [] },
    ],
    no_location: { name: "No Location" as const, books: [suggestedOne, suggestedTwo] },
  };
  render(<GroupedLocationBooks data={data} viewMode="grid" locations={[]} categories={[]} showCovers onSelect={onSelect} />);

  const firstLocation = document.querySelector('[data-location-group="1"]') as HTMLElement;
  const firstLocationBooks = within(firstLocation.querySelector('[data-testid="grid-books"]') as HTMLElement).getAllByRole("button");
  expect(firstLocationBooks.map((element) => element.textContent)).toEqual(["Suggested A Suggested", "Assigned B", "Suggested C Suggested"]);
  const nestedLocation = document.querySelector('[data-location-group="2"]') as HTMLElement;
  expect(within(nestedLocation).getByText("Suggested A Suggested")).toBeTruthy();
  const similarlyNamedLocation = document.querySelector('[data-location-group="3"]') as HTMLElement;
  expect(within(similarlyNamedLocation).queryByText("Suggested A Suggested")).toBeNull();

  fireEvent.click(firstLocationBooks[0]);
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(within(document.querySelector('[data-location-group="no-location"]') as HTMLElement).getByText("Suggested A"));
  expect(onSelect).toHaveBeenCalledWith(suggestedOne);
});

it("passes the exact suggested Location to provisional Grid and List clicks", () => {
  const onSuggestedSelect = vi.fn();
  const location = { id: 7, name: "Shelf", path: [{ id: 1, name: "Room" }, { id: 7, name: "Shelf" }] };
  const data = { locations: [{ id: 7, name: "Shelf", books: [], children: [] }], no_location: { name: "No Location" as const, books: [{ ...book(10, "Suggested"), suggested_locations: [location] }] } };
  const { rerender } = render(<GroupedLocationBooks data={data} viewMode="grid" locations={[]} categories={[]} showCovers onSelect={vi.fn()} onSuggestedSelect={onSuggestedSelect} />);
  fireEvent.click(document.querySelector('[data-location-group="7"] button') as HTMLElement);
  expect(onSuggestedSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }), location);

  rerender(<GroupedLocationBooks data={data} viewMode="list" locations={[]} categories={[]} showCovers onSelect={vi.fn()} onSuggestedSelect={onSuggestedSelect} />);
  fireEvent.click(document.querySelector('[data-location-group="7"] button') as HTMLElement);
  expect(onSuggestedSelect).toHaveBeenLastCalledWith(expect.objectContaining({ id: 10 }), location);
});

it("passes suggested state to the list renderer but keeps No Location copies normal", () => {
  const suggested = { ...book(10, "Suggested"), suggested_locations: [{ id: 1, name: "Shelf", path: [] }] };
  const data = { locations: [{ id: 1, name: "Shelf", books: [], children: [] }], no_location: { name: "No Location" as const, books: [suggested] } };
  render(<GroupedLocationBooks data={data} viewMode="list" locations={[]} categories={[]} showCovers onSelect={vi.fn()} />);
  expect(document.querySelector('[data-location-group="1"] [data-suggested-book="true"]')).toBeTruthy();
  expect(document.querySelector('[data-location-group="no-location"] [data-suggested-book="true"]')).toBeNull();
});
