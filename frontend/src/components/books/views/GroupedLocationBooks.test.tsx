// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("./BookGridView", () => ({
  BookGridView: ({ books, onSelect, showLocationPositions }: any) => <div data-testid="grid-books">{books.map((book: any) => <button key={book.id} onClick={() => onSelect(book)}>{book.title}{showLocationPositions && book.location_position != null && ` #${book.location_position}`}</button>)}</div>,
}));
vi.mock("./BookListView", () => ({
  BookListView: ({ books, onSelect, showLocationPositions }: any) => <div data-testid="list-books">{books.map((book: any) => <button key={book.id} onClick={() => onSelect(book)}>{book.title}{showLocationPositions && book.location_position != null && ` #${book.location_position}`}</button>)}</div>,
}));

import { GroupedLocationBooks } from "./GroupedLocationBooks";

const book = (id: number, title: string) => ({ id, title, author: "Author", read: false, location_id: null });
const grouped = {
  locations: [
    { id: 2, name: "Shelf H", books: [{ ...book(2, "Parent book"), location_id: 2, location_position: 1 }], children: [{ id: 3, name: "Shelf G", books: [{ ...book(3, "Nested book"), location_id: 3, location_position: 1 }], children: [] }] },
    { id: 1, name: "Room Divider", books: [book(1, "Root book")], children: [] },
  ],
  no_location: { name: "No Location" as const, books: [book(4, "Unlocated")] },
};

afterEach(cleanup);

it("renders the backend hierarchy and order, with No Location last", () => {
  render(<GroupedLocationBooks data={grouped} viewMode="grid" locations={[]} categories={[]} showCovers onSelect={vi.fn()} />);
  expect(Array.from(document.querySelectorAll("[data-location-group]")).map((node) => node.getAttribute("data-location-group"))).toEqual(["2", "3", "1", "no-location"]);
  expect(screen.getAllByTestId("grid-books")).toHaveLength(4);
  expect(screen.getByText("Parent book #1")).toBeTruthy();
  expect(screen.getByText("Nested book #1")).toBeTruthy();
  expect(screen.getByText("Unlocated")).toBeTruthy();
});

it("uses list view and omits No Location when the API returns null", () => {
  const onSelect = vi.fn();
  render(<GroupedLocationBooks data={{ ...grouped, no_location: null }} viewMode="list" locations={[]} categories={[]} showCovers onSelect={onSelect} />);
  expect(screen.getAllByTestId("list-books")).toHaveLength(3);
  expect(screen.queryByText("No Location")).toBeNull();
  fireEvent.click(screen.getByText("Nested book #1"));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
});

it.each(["grid", "list"] as const)("renders suggested books only in No Location in %s view", (viewMode) => {
  const onSelect = vi.fn();
  const onUnassignedSelect = vi.fn();
  const suggested = { ...book(10, "Suggested"), suggested_locations: [{ id: 1, name: "Shelf", path: [] }, { id: 2, name: "Other", path: [] }] };
  const data = { locations: [{ id: 1, name: "Shelf", books: [{ ...book(1, "Assigned"), location_id: 1, location_position: 12 }], children: [] }, { id: 2, name: "Other", books: [], children: [] }], no_location: { name: "No Location" as const, books: [suggested] } };
  render(<GroupedLocationBooks data={data} viewMode={viewMode} locations={[]} categories={[]} showCovers onSelect={onSelect} onUnassignedSelect={onUnassignedSelect} />);
  expect(screen.getAllByText("Suggested")).toHaveLength(1);
  expect(within(document.querySelector('[data-location-group="1"]') as HTMLElement).queryByText("Suggested")).toBeNull();
  expect(within(document.querySelector('[data-location-group="2"]') as HTMLElement).queryByText("Suggested")).toBeNull();
  fireEvent.click(screen.getByText("Suggested"));
  expect(onUnassignedSelect).toHaveBeenCalledWith(suggested);
  expect(onSelect).not.toHaveBeenCalled();
});
