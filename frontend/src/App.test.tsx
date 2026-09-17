// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ root: vi.fn(), collection: vi.fn() }));
vi.mock("./api/collections", () => ({ browseRootCollections: api.root, browseCollection: api.collection }));
vi.mock("./hooks/useBooks", () => ({ useBooks: () => ({ books: [], loadMoreBooks: vi.fn(), hasMore: false, addBook: vi.fn(), addBookFromISBN: vi.fn(), removeBook: vi.fn(), saveBook: vi.fn(), updateFilters: vi.fn(), isLoading: false, loadError: null, filters: {} }) }));
vi.mock("./context/LocationContext", () => ({ useLocations: () => ({ locations: [] }) }));
vi.mock("./context/CategoryContext", () => ({ useCategories: () => ({ categories: [] }) }));
vi.mock("./context/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true, login: vi.fn(), logout: vi.fn() }) }));
vi.mock("./hooks/usePreferences", () => ({ usePreferences: () => ({ preferences: { library_name: "Library", library_view_mode: "grid", show_collections_in_library: true, root_collection_display_mode: "collections_only" }, updatePreferences: vi.fn() }) }));
vi.mock("./hooks/useSearch", () => ({ useSearch: () => ({ searchInput: "", setSearchInput: vi.fn() }) }));
vi.mock("./hooks/useBookActions", () => ({ useBookActions: () => ({ isFetching: false, handleSearch: vi.fn(), handleAddBook: vi.fn(), handleQuickAdd: vi.fn(), handleAddAndReview: vi.fn(), handleDelete: vi.fn(), handleSave: vi.fn(), resetAddBook: vi.fn(), handleAddBookISBNChange: vi.fn() }) }));
vi.mock("./api/books", () => ({ getBook: vi.fn() }));
vi.mock("./api/auth", () => ({ login: vi.fn() }));
vi.mock("./components/books/views/BookGridView", () => ({ BookGridView: ({ items, collections, books, onSelectCollection }: any) => <div data-testid="grid">{(items ?? collections ?? []).map((item: any) => { const collection = item.collection ?? item; return <button key={collection.id} onClick={() => onSelectCollection?.(collection)}>{collection.name}</button>; })}{books.map((book: any) => <span key={book.id}>{book.title}</span>)}</div> }));
vi.mock("./components/layout/Header", () => ({ Header: () => null }));
vi.mock("./components/layout/TopPanels", () => ({ TopPanels: () => null }));
vi.mock("./components/search/SearchBar", () => ({ SearchBar: () => null }));
vi.mock("./components/books/views/ViewModeSwitcher", () => ({ ViewModeSwitcher: () => null }));
vi.mock("./components/settings/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("./components/books/BookPanel", () => ({ BookPanel: () => null }));
vi.mock("./components/settings/maintenance/MaintenanceReviewSession", () => ({ MaintenanceReviewSession: () => null }));
vi.mock("./components/books/AddBookDialog", () => ({ AddBookDialog: () => null }));
vi.mock("./components/books/CheckLibraryDialog", () => ({ CheckLibraryDialog: () => null }));

import App from "./App";

function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>((done) => { resolve = done; }), resolve }; }
const root = { id: 1, name: "Root", node_type: "series", author: null, description: null, cover_url: null, parent_id: null };
const nested = { ...root, id: 2, name: "Nested", parent_id: 1 };

it("keeps the source collection coherent until destination data is ready and ignores stale navigation", async () => {
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  const initial = deferred<any>(); const first = deferred<any>(); const second = deferred<any>();
  api.root.mockReturnValueOnce(initial.promise);
  api.collection.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  render(<App />);
  await act(async () => initial.resolve({ collection: null, items: [{ kind: "collection", collection: root }, { kind: "collection", collection: nested }], collections: [], books: [], total: 2 }));
  fireEvent.click(screen.getByText("Root"));
  fireEvent.click(screen.getByText("Nested"));
  expect(screen.getByText("Books")).toBeTruthy();
  expect(screen.getByText("Root")).toBeTruthy();
  await act(async () => second.resolve({ collection: nested, collections: [], books: [{ id: 9, title: "Nested book" }], total: 1 }));
  expect(screen.getAllByText("Nested").length).toBeGreaterThan(0);
  expect(screen.getByText("Nested book")).toBeTruthy();
  const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
  expect(breadcrumb.querySelector("ol")).toBeTruthy();
  expect(breadcrumb.querySelectorAll("svg")).toHaveLength(0);
  expect(breadcrumb.querySelector('[aria-current="page"]')?.tagName).toBe("SPAN");
  expect(screen.getByLabelText("Collection sort")).toBeTruthy();
  expect(breadcrumb.compareDocumentPosition(document.querySelector("h2")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(async () => first.resolve({ collection: root, collections: [], books: [{ id: 8, title: "Stale book" }], total: 1 }));
  expect(screen.queryByText("Stale book")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  expect(screen.getByText("Root")).toBeTruthy();
  expect(api.root).toHaveBeenCalledTimes(1);
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
});

it("keeps the Series order selector out of Group browsing", async () => {
  api.root.mockReset(); api.collection.mockReset();
  const group = { ...root, id: 7, name: "Group collection", node_type: "group" as const };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "collection", collection: group }], collections: [], books: [], total: 1 });
  api.collection.mockResolvedValue({ collection: group, collections: [], books: [], total: 0 });
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Group collection"));
  await act(async () => undefined);
  expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeTruthy();
  expect(screen.queryByLabelText("Collection sort")).toBeNull();
});

it("shows a quiet message for a truly empty collection after its result is loaded", async () => {
  api.root.mockReset(); api.collection.mockReset();
  const empty = { ...root, id: 8, name: "Empty collection" };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "collection", collection: empty }], collections: [], books: [], total: 1 });
  api.collection.mockResolvedValue({ collection: empty, collections: [], books: [], total: 0 });
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Empty collection"));
  await act(async () => undefined);
  expect(screen.getAllByText("This collection is empty.").length).toBeGreaterThan(0);
});
