// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ root: vi.fn(), collection: vi.fn(), grouped: vi.fn(), getBook: vi.fn(), saveBook: vi.fn(), out: vi.fn(), takeOut: vi.fn(), preview: vi.fn(), confirmReturn: vi.fn(), reconcileCheckout: vi.fn() }));
const feedback = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const browseState = vi.hoisted(() => ({ filters: {} as { search?: string; categoryId?: number | null; locationId?: number | null; read?: boolean | null } }));
vi.mock("./api/collections", () => ({ browseRootCollections: api.root, browseCollection: api.collection }));
vi.mock("./hooks/useBooks", () => ({ useBooks: () => ({ books: [], loadMoreBooks: vi.fn(), hasMore: false, addBook: vi.fn(), addBookFromISBN: vi.fn(), removeBook: vi.fn(), saveBook: api.saveBook, reconcileCheckout: api.reconcileCheckout, updateFilters: vi.fn(), isLoading: false, loadError: null, filters: browseState.filters }) }));
vi.mock("./context/LocationContext", () => ({ useLocations: () => ({ locations: [] }) }));
vi.mock("./context/CategoryContext", () => ({ useCategories: () => ({ categories: [] }) }));
vi.mock("./context/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true, login: vi.fn(), logout: vi.fn() }) }));
vi.mock("./hooks/usePreferences", () => ({ usePreferences: () => ({ preferences: { library_name: "Library", library_view_mode: "grid", show_collections_in_library: true, root_collection_display_mode: "collections_only" }, updatePreferences: vi.fn() }) }));
vi.mock("./hooks/useSearch", () => ({ useSearch: () => ({ searchInput: "", setSearchInput: vi.fn() }) }));
vi.mock("./hooks/useBookActions", () => ({ useBookActions: (params: any) => ({ isFetching: false, handleSearch: vi.fn(), handleAddBook: vi.fn(), handleQuickAdd: vi.fn(), handleAddAndReview: vi.fn(), handleDelete: async (id: number) => { await params.removeBook(id); params.reconcileDeletedBook(id); params.setSelectedBook(null); }, handleSave: async () => { const updated = await params.saveBook(params.editData); params.reconcileSavedBook?.(updated); params.setSelectedBook(updated); params.setEditData(updated); params.setEditing(false); params.reconcileGroupedBooks?.(); }, resetAddBook: vi.fn(), handleAddBookISBNChange: vi.fn() }) }));
vi.mock("./api/books", () => ({ getBook: api.getBook, getGroupedBooks: api.grouped, getOutOfLibrary: api.out, takeOutBook: api.takeOut, getReturnPreview: api.preview, confirmReturnBook: api.confirmReturn }));
vi.mock("./api/auth", () => ({ login: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: feedback }));
vi.mock("./components/books/views/BookGridView", () => ({ BookGridView: ({ items, collections, books, onSelectCollection, onSelect, suggestedBookIds, suggestedLocationsByBookId, onSuggestedSelect }: any) => <div data-testid="grid">{(items ?? [
  ...(collections ?? []).map((collection: any) => ({ kind: "collection", collection })),
  ...(books ?? []).map((book: any) => ({ kind: "book", book })),
]).map((item: any) => item.kind === "collection"
  ? <button key={`collection-${item.collection.id}`} onClick={() => onSelectCollection?.(item.collection)}>{item.collection.name}</button>
  : <button key={`book-${item.book.id}`} data-cover={item.book.cover_url ?? ""} onClick={() => suggestedBookIds?.has(item.book.id) ? onSuggestedSelect?.(item.book, suggestedLocationsByBookId?.get(item.book.id)) : onSelect?.(item.book)}>{item.book.title}</button>)}</div> }));
vi.mock("./components/layout/Header", () => ({ Header: () => null }));
vi.mock("./components/layout/TopPanels", () => ({ TopPanels: () => null }));
vi.mock("./components/search/SearchBar", () => ({ SearchBar: () => null }));
vi.mock("./components/books/views/ViewModeSwitcher", () => ({ ViewModeSwitcher: () => null }));
vi.mock("./components/settings/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("./components/books/BookPanel", () => ({ BookPanel: ({ book, openedInCollection, editing, editData, setEditing, setEditData, onClose, onDelete, onSave, onTakeOut, onReturnToShelf }: any) => <section data-testid="book-panel"><span data-testid="panel-title">{book.title}</span><span data-testid="opened-in-collection">{String(openedInCollection)}</span><span data-testid="panel-publisher">{book.publisher}</span><span data-testid="panel-location">{book.location_id}</span><span data-testid="panel-category">{book.category_id}</span><button onClick={() => onTakeOut?.(book.id)}>Take Out</button><button onClick={() => onReturnToShelf?.(book.id)}>Return to Shelf</button><button onClick={() => { setEditData(book); setEditing(true); }}>Edit selected book</button><button onClick={onClose}>Close selected book</button><button onClick={() => void onDelete(book.id)}>Delete selected book</button>{editing && <><button onClick={() => void onSave()}>Save selected book</button><span data-testid="edit-publisher">{editData?.publisher}</span><span data-testid="edit-year">{editData?.year}</span><span data-testid="edit-language">{editData?.language}</span><span data-testid="edit-pages">{editData?.page_count}</span><span data-testid="edit-isbn">{editData?.isbn}</span><span data-testid="edit-description">{editData?.description}</span><span data-testid="edit-location">{editData?.location_id}</span><span data-testid="edit-category">{editData?.category_id}</span></>}</section> }));
vi.mock("./components/settings/maintenance/MaintenanceReviewSession", () => ({ MaintenanceReviewSession: () => null }));
vi.mock("./components/books/AddBookDialog", () => ({ AddBookDialog: () => null }));
vi.mock("./components/books/CheckLibraryDialog", () => ({ CheckLibraryDialog: () => null }));

import App, { reconcileCollectionBrowseBook } from "./App";
import type { CollectionBrowseBook, CollectionBrowseResult } from "./api/collections";
import type { Book } from "./types/book";
import type { Series } from "./types/series";

function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>((done) => { resolve = done; }), resolve }; }
const root: Series = { id: 1, owner_id: 1, name: "Root", node_type: "series", author: null, description: null, cover_url: null, parent_id: null, created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" };
const nested = { ...root, id: 2, name: "Nested", parent_id: 1 };

beforeEach(() => {
  browseState.filters = {};
  api.out.mockReset().mockResolvedValue([]);
  api.getBook.mockReset();
  api.saveBook.mockReset();
  feedback.success.mockReset();
  feedback.error.mockReset();
});

afterEach(() => {
  cleanup();
});

it("takes a book out and confirms return without resetting the library or scroll", async () => {
  const present = { id: 301, title: "Checkout target", author: "Ada Adams", location_id: 9, is_checked_out: false, read: false };
  const out = { ...present, is_checked_out: true, location_position: null, location_total: null };
  let current = present;
  let rootItems: any[] = [{ kind: "book", book: present }];
  let outItems: any[] = [];
  api.root.mockReset().mockImplementation(async () => ({ collection: null, collections: [], books: [], items: rootItems, total: rootItems.length }));
  api.out.mockImplementation(async () => outItems);
  api.getBook.mockImplementation(async () => ({ ...current, publisher: "Hydrated" }));
  api.takeOut.mockImplementation(async () => { current = out; rootItems = []; outItems = [out]; return out; });
  api.preview.mockResolvedValue({ book: out, location_id: 9, before: [], after: [] });
  api.confirmReturn.mockImplementation(async () => { current = present; rootItems = [{ kind: "book", book: present }]; outItems = []; return present; });
  const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Checkout target" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Checkout target" }));
  await waitFor(() => expect(screen.getByTestId("panel-publisher").textContent).toBe("Hydrated"));
  const scrollCallsBeforeCheckout = scrollTo.mock.calls.length;
  fireEvent.click(screen.getByRole("button", { name: "Take Out" }));
  await waitFor(() => expect(api.reconcileCheckout).toHaveBeenCalledWith(out));
  await waitFor(() => expect(screen.getByRole("region", { name: "Out of Library" })).toBeTruthy());
  expect(screen.getAllByRole("button", { name: /Checkout target/ })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Return to Shelf" }));
  await waitFor(() => expect(screen.getByText("THIS BOOK")).toBeTruthy());
  expect(api.confirmReturn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(api.confirmReturn).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Return to Shelf" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Confirm Return" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Confirm Return" }));
  await waitFor(() => expect(api.reconcileCheckout).toHaveBeenCalledWith(present));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Out of Library" })).toBeNull());
  expect(screen.getByRole("button", { name: "Checkout target" })).toBeTruthy();
  expect(scrollTo.mock.calls.slice(scrollCallsBeforeCheckout).every((args) => typeof args[0] !== "object")).toBe(true);
  scrollTo.mockRestore();
});

it("ignores a root page from an old filter and allows the new filter to keep paging", async () => {
  api.root.mockReset();
  const stale = deferred<any>();
  const oldBook = { id: 401, title: "Old book", author: "Author" };
  const newBook = { id: 402, title: "New book", author: "Author" };
  api.root.mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: oldBook }], books: [], collections: [], total: 3 })
    .mockReturnValueOnce(stale.promise)
    .mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: newBook }], books: [], collections: [], total: 2 })
    .mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: { id: 403, title: "Newer book", author: "Author" } }], books: [], collections: [], total: 2 });
  const view = render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Old book" })).toBeTruthy());
  await waitFor(() => expect(screen.queryByText("Searching...")).toBeNull());
  fireEvent.scroll(window);
  await waitFor(() => expect(api.root).toHaveBeenCalledTimes(2));
  browseState.filters = { search: "New" };
  view.rerender(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "New book" })).toBeTruthy());
  await act(async () => stale.resolve({ collection: null, items: [{ kind: "book", book: { id: 404, title: "Stale book", author: "Author" } }], books: [], collections: [], total: 3 }));
  expect(screen.queryByRole("button", { name: "Stale book" })).toBeNull();
  fireEvent.scroll(window);
  await waitFor(() => expect(api.root).toHaveBeenCalledTimes(4));
  expect(api.root.mock.calls[3][0]).toEqual(expect.objectContaining({ search: "New", skip: 1 }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Newer book" })).toBeTruthy());
});

it("appends valid root pages once and advances the server offset past repeated IDs", async () => {
  api.root.mockReset().mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: { id: 411, title: "First", author: "Author" } }], books: [], collections: [], total: 5 })
    .mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: { id: 411, title: "First", author: "Author" } }, { kind: "book", book: { id: 412, title: "Second", author: "Author" } }], books: [], collections: [], total: 5 })
    .mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: { id: 413, title: "Third", author: "Author" } }, { kind: "book", book: { id: 414, title: "Fourth", author: "Author" } }], books: [], collections: [], total: 5 });
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "First" })).toBeTruthy());
  await waitFor(() => expect(screen.queryByText("Searching...")).toBeNull());
  fireEvent.scroll(window);
  await waitFor(() => expect(api.root).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole("button", { name: "Second" })).toBeTruthy());
  expect(screen.getAllByRole("button", { name: "First" })).toHaveLength(1);
  fireEvent.scroll(window);
  await waitFor(() => expect(screen.getByRole("button", { name: "Fourth" })).toBeTruthy());
  expect(api.root.mock.calls[2][0]).toEqual(expect.objectContaining({ skip: 3 }));
});

it("does not append a root page after entering a Collection", async () => {
  api.root.mockReset(); api.collection.mockReset();
  const pending = deferred<any>();
  api.root.mockResolvedValueOnce({ collection: null, items: [{ kind: "collection", collection: root }], books: [], collections: [root], total: 2 })
    .mockReturnValueOnce(pending.promise);
  api.collection.mockResolvedValue({ collection: root, items: [], books: [{ id: 415, title: "Inside", author: "Author" }], collections: [], total: 1 });
  render(<App />);
  await waitFor(() => expect(screen.getByText("Root")).toBeTruthy());
  await waitFor(() => expect(screen.queryByText("Searching...")).toBeNull());
  fireEvent.scroll(window);
  await waitFor(() => expect(api.root).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByText("Root"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Inside" })).toBeTruthy());
  await act(async () => pending.resolve({ collection: null, items: [{ kind: "book", book: { id: 416, title: "Stale root", author: "Author" } }], books: [], collections: [], total: 2 }));
  expect(screen.queryByRole("button", { name: "Stale root" })).toBeNull();
  expect(screen.getByRole("button", { name: "Inside" })).toBeTruthy();
});

it("discards a pending root page after checkout and clears its loading state", async () => {
  api.root.mockReset(); api.getBook.mockReset();
  const pending = deferred<any>();
  const present = { id: 421, title: "Present book", author: "Author", location_id: 9, is_checked_out: false };
  const out = { ...present, is_checked_out: true };
  api.root.mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: present }], books: [], collections: [], total: 2 })
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce({ collection: null, items: [], books: [], collections: [], total: 0 });
  api.getBook.mockResolvedValue(present);
  api.takeOut.mockResolvedValue(out);
  api.out.mockResolvedValueOnce([]).mockResolvedValueOnce([out]);
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Present book" })).toBeTruthy());
  await waitFor(() => expect(screen.queryByText("Searching...")).toBeNull());
  fireEvent.scroll(window);
  await waitFor(() => expect(api.root).toHaveBeenCalledTimes(2));
  fireEvent.click(screen.getByRole("button", { name: "Present book" }));
  await waitFor(() => expect(screen.getByTestId("book-panel")).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Take Out" }));
  await waitFor(() => expect(api.root).toHaveBeenCalledTimes(3));
  await act(async () => pending.resolve({ collection: null, items: [{ kind: "book", book: present }], books: [], collections: [], total: 2 }));
  await waitFor(() => expect(screen.queryByText("Searching...")).toBeNull());
  expect(screen.getByRole("region", { name: "Out of Library" })).toBeTruthy();
  expect(screen.getAllByRole("button", { name: /Present book/ })).toHaveLength(1);
});

it("shows an out book without an empty-shelf message in grouped browsing", async () => {
  const out = { id: 302, title: "Out title", author: "A Author", location_id: 9, is_checked_out: true };
  api.root.mockResolvedValue({ collection: null, collections: [], books: [], items: [], total: 0 });
  api.grouped.mockResolvedValue({ locations: [], no_location: null });
  api.out.mockResolvedValue([out]);
  render(<App />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Group by Location" }));
  await waitFor(() => expect(screen.getByRole("region", { name: "Out of Library" })).toBeTruthy());
  expect(screen.queryByText("Your library is empty.")).toBeNull();
});

it("reconciles and reorders retained root book tiles", () => {
  const originalBook: CollectionBrowseBook = { id: 90, title: "Old title", author: "Old author", cover_url: "/covers/old.jpg", read: false, publication_order: 2, chronological_order: 4, reading_order: 3 };
  const untouchedBook: CollectionBrowseBook = { id: 91, title: "Untouched", author: "Author", cover_url: "/covers/keep.jpg", read: false, publication_order: 5, chronological_order: 6, reading_order: 7 };
  const collection = { ...root, id: 93, name: "Unchanged collection" };
  const browse: CollectionBrowseResult = {
    collection: null,
    items: [{ kind: "collection" as const, collection }, { kind: "book" as const, book: originalBook }, { kind: "book" as const, book: untouchedBook }],
    collections: [collection],
    books: [originalBook, untouchedBook],
    total: 42,
  };
  const updated: Book = { id: originalBook.id, title: "New title", author: "New author", year: 2026, cover_url: "/covers/objects/sha256/new-cover.jpg" };
  const merged = { ...originalBook, ...updated };

  const reconciled = reconcileCollectionBrowseBook(browse, updated);

  expect(reconciled.books).toEqual([merged, untouchedBook]);
  expect(reconciled.items).toEqual([{ kind: "book", book: merged }, { kind: "book", book: untouchedBook }, { kind: "collection", collection }]);
  expect(reconciled.collections).toBe(browse.collections);
  expect(reconciled.total).toBe(42);
});

it("retains a matching Collection tile when search has surrounding whitespace", () => {
  const originalBook: CollectionBrowseBook = { id: 95, title: "Old title", author: "Ada", read: false, publication_order: null, chronological_order: null, reading_order: null };
  const browse: CollectionBrowseResult = {
    collection: root, items: [], collections: [], books: [originalBook], total: 1,
  };
  const updated: Book = { id: originalBook.id, title: "Alpha", author: "Ada" };

  const reconciled = reconcileCollectionBrowseBook(browse, updated, { search: "  Alpha  " });

  expect(reconciled.books).toEqual([{ ...originalBook, ...updated }]);
  expect(reconciled.total).toBe(1);
});

it("reconciles a saved book in the current collection browse and retained root snapshot without refetching", async () => {
  api.root.mockReset(); api.collection.mockReset(); api.getBook.mockReset(); api.saveBook.mockReset();
  const stale: CollectionBrowseBook = { id: 94, title: "Old title", author: "Old author", cover_url: "/covers/old.jpg", read: false, publication_order: 1, chronological_order: 1, reading_order: 1 };
  const updated: Book = { id: stale.id, title: "New title", author: "New author", year: 2026, cover_url: "/covers/objects/sha256/new-cover.jpg" };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "collection", collection: root }, { kind: "book", book: stale }], collections: [root], books: [stale], total: 20 });
  api.collection.mockResolvedValue({ collection: root, items: [], collections: [], books: [stale], total: 20 });
  api.getBook.mockResolvedValue(stale);
  api.saveBook.mockResolvedValue(updated);

  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Root"));
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Old title"));
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Edit selected book"));
  fireEvent.click(screen.getByText("Save selected book"));
  await act(async () => undefined);

  const current = screen.getByTestId("grid").querySelector("button")!;
  expect(current.getAttribute("data-cover")).toBe(updated.cover_url);
  expect(screen.queryByText("Old title")).toBeNull();
  expect(api.root).toHaveBeenCalledTimes(1);
  expect(api.collection).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  const restored = Array.from(screen.getByTestId("grid").querySelectorAll("button"))
    .find((button) => button.textContent === "New title")!;
  expect(restored.getAttribute("data-cover")).toBe(updated.cover_url);
  expect(api.root).toHaveBeenCalledTimes(1);
  expect(api.collection).toHaveBeenCalledTimes(1);
});

it("removes a saved book that no longer matches Collection search without resetting browse", async () => {
  api.root.mockReset(); api.getBook.mockReset(); api.saveBook.mockReset();
  browseState.filters = { search: "Needle" };
  const before = { id: 431, title: "Needle title", author: "Author", read: false };
  const after = { ...before, title: "Changed title" };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "book", book: before }], books: [], collections: [], total: 1 });
  api.getBook.mockResolvedValue(before);
  api.saveBook.mockResolvedValue(after);
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Needle title" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Needle title" }));
  await waitFor(() => expect(screen.getByTestId("book-panel")).toBeTruthy());
  fireEvent.click(screen.getByText("Edit selected book"));
  fireEvent.click(screen.getByText("Save selected book"));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Needle title" })).toBeNull());
  expect(screen.queryByRole("button", { name: "Changed title" })).toBeNull();
  expect(api.root).toHaveBeenCalledTimes(1);
});

it("keeps root pagination aligned when an edited author moves past loaded tiles", async () => {
  api.root.mockReset(); api.getBook.mockReset(); api.saveBook.mockReset();
  const first = { id: 435, title: "First", author: "Ann Adams", read: false };
  const second = { id: 436, title: "Second", author: "Ben Baker", read: false };
  api.root.mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: first }, { kind: "book", book: second }], books: [], collections: [], total: 3 })
    .mockResolvedValueOnce({ collection: null, items: [{ kind: "book", book: { id: 437, title: "Next", author: "Cal Clark" } }], books: [], collections: [], total: 3 });
  api.getBook.mockResolvedValue(first);
  api.saveBook.mockResolvedValue({ ...first, author: "Zoe Zulu" });
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: "First" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "First" }));
  await waitFor(() => expect(screen.getByTestId("book-panel")).toBeTruthy());
  fireEvent.click(screen.getByText("Edit selected book"));
  fireEvent.click(screen.getByText("Save selected book"));
  await waitFor(() => expect(screen.queryByRole("button", { name: "First" })).toBeNull());
  fireEvent.scroll(window);
  await waitFor(() => expect(screen.getByRole("button", { name: "Next" })).toBeTruthy());
  expect(api.root.mock.calls[1][0]).toEqual(expect.objectContaining({ skip: 1 }));
});

it("reorders saved Series tiles within loaded pages", async () => {
  api.root.mockReset(); api.collection.mockReset(); api.getBook.mockReset(); api.saveBook.mockReset();
  const first = { id: 441, title: "Alpha", author: "Author", read: false, reading_order: null, publication_order: null, chronological_order: null };
  const second = { ...first, id: 442, title: "Beta" };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "collection", collection: root }], books: [], collections: [], total: 1 });
  api.collection.mockResolvedValue({ collection: root, items: [], books: [first, second], collections: [], total: 2 });
  api.getBook.mockResolvedValue(second);
  api.saveBook.mockResolvedValue({ ...second, title: "Aardvark" });
  render(<App />);
  await waitFor(() => expect(screen.getByText("Root")).toBeTruthy());
  fireEvent.click(screen.getByText("Root"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Beta" })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: "Beta" }));
  await waitFor(() => expect(screen.getByTestId("book-panel")).toBeTruthy());
  fireEvent.click(screen.getByText("Edit selected book"));
  fireEvent.click(screen.getByText("Save selected book"));
  await waitFor(() => expect(screen.getByRole("button", { name: "Aardvark" })).toBeTruthy());
  expect(Array.from(screen.getByTestId("grid").querySelectorAll("button")).map((item) => item.textContent)).toEqual(["Aardvark", "Alpha"]);
  expect(api.collection).toHaveBeenCalledTimes(1);
});

it("updates and filters an edited Out of Library card locally", async () => {
  api.root.mockReset(); api.getBook.mockReset(); api.saveBook.mockReset(); api.out.mockReset();
  browseState.filters = { search: "Needle" };
  const before = { id: 451, title: "Needle out", author: "Author", location_id: 9, is_checked_out: true };
  const updated = { ...before, title: "Needle updated", cover_url: "/new-cover.jpg" };
  const noMatch = { ...updated, title: "Different title" };
  api.root.mockResolvedValue({ collection: null, items: [], books: [], collections: [], total: 0 });
  api.out.mockResolvedValueOnce([before]).mockResolvedValueOnce([updated]).mockResolvedValueOnce([]);
  api.getBook.mockResolvedValueOnce(before).mockResolvedValueOnce(updated);
  api.saveBook.mockResolvedValueOnce(updated).mockResolvedValueOnce(noMatch);
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Needle out/ })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /Needle out/ }));
  await waitFor(() => expect(screen.getByTestId("book-panel")).toBeTruthy());
  fireEvent.click(screen.getByText("Edit selected book"));
  fireEvent.click(screen.getByText("Save selected book"));
  await waitFor(() => expect(screen.getByRole("button", { name: /Needle updated/ })).toBeTruthy());
  expect(screen.getByRole("region", { name: "Out of Library" }).querySelector("img")?.getAttribute("src")).toBe("/new-cover.jpg");
  fireEvent.click(screen.getByText("Close selected book"));
  fireEvent.click(screen.getByRole("button", { name: /Needle updated/ }));
  await waitFor(() => expect(screen.getByTestId("book-panel")).toBeTruthy());
  fireEvent.click(screen.getByText("Edit selected book"));
  fireEvent.click(screen.getByText("Save selected book"));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Out of Library" })).toBeNull());
  expect(api.root).toHaveBeenCalledTimes(1);
});

it("removes a deleted checked-out book from Out of Library immediately", async () => {
  api.root.mockReset(); api.getBook.mockReset(); api.out.mockReset();
  const out = { id: 461, title: "Gone out", author: "Author", location_id: 9, is_checked_out: true };
  api.root.mockResolvedValue({ collection: null, items: [], books: [], collections: [], total: 0 });
  api.out.mockResolvedValueOnce([out]).mockResolvedValueOnce([]);
  api.getBook.mockResolvedValue(out);
  render(<App />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Gone out/ })).toBeTruthy());
  fireEvent.click(screen.getByRole("button", { name: /Gone out/ }));
  await waitFor(() => expect(screen.getByTestId("book-panel")).toBeTruthy());
  fireEvent.click(screen.getByText("Delete selected book"));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Out of Library" })).toBeNull());
  expect(api.root).toHaveBeenCalledTimes(1);
});

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

it("hydrates a lightweight root browse book before opening the panel and supplies Book Edit with complete metadata", async () => {
  api.root.mockReset(); api.collection.mockReset();
  const tile = { id: 22, title: "The Life and Times of the Thunderbolt Kid", author: "Bill Bryson", cover_url: "/cover.jpg", read: false };
  const fullBook = {
    ...tile,
    subtitle: "A Memoir",
    publisher: "Random House",
    language: "en",
    page_count: 420,
    year: 2007,
    isbn: "9780552772549",
    description: "Populated description",
    location_id: 12,
    category_id: 7,
  };
  const request = deferred<any>();
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "book", book: tile }], collections: [], books: [], total: 1 });
  api.getBook.mockReturnValue(request.promise);
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText(tile.title));
  expect(api.getBook).toHaveBeenCalledWith(22);
  expect(screen.queryByTestId("book-panel")).toBeNull();

  await act(async () => request.resolve(fullBook));
  expect(screen.getByTestId("panel-publisher").textContent).toBe("Random House");
  expect(screen.getByTestId("opened-in-collection").textContent).toBe("false");
  expect(screen.getByTestId("panel-location").textContent).toBe("12");
  expect(screen.getByTestId("panel-category").textContent).toBe("7");

  fireEvent.click(screen.getByText("Edit selected book"));
  expect(screen.getByTestId("edit-publisher").textContent).toBe("Random House");
  expect(screen.getByTestId("edit-year").textContent).toBe("2007");
  expect(screen.getByTestId("edit-language").textContent).toBe("en");
  expect(screen.getByTestId("edit-pages").textContent).toBe("420");
  expect(screen.getByTestId("edit-isbn").textContent).toBe("9780552772549");
  expect(screen.getByTestId("edit-description").textContent).toBe("Populated description");
  expect(screen.getByTestId("edit-location").textContent).toBe("12");
  expect(screen.getByTestId("edit-category").textContent).toBe("7");
});

it("uses the same hydration path for nested collection books and ignores stale book responses", async () => {
  api.root.mockReset(); api.collection.mockReset();
  const first = { id: 31, title: "First", author: "Author", cover_url: null, read: false };
  const second = { id: 32, title: "Second", author: "Author", cover_url: null, read: false };
  const firstRequest = deferred<any>();
  const secondRequest = deferred<any>();
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "collection", collection: root }], collections: [], books: [], total: 1 });
  api.collection.mockResolvedValue({ collection: root, collections: [], books: [first, second], total: 2 });
  api.getBook.mockReturnValueOnce(firstRequest.promise).mockReturnValueOnce(secondRequest.promise);
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Root"));
  await act(async () => undefined);
  fireEvent.click(screen.getByText("First"));
  fireEvent.click(screen.getByText("Second"));
  expect(api.getBook).toHaveBeenNthCalledWith(1, 31);
  expect(api.getBook).toHaveBeenNthCalledWith(2, 32);

  await act(async () => secondRequest.resolve({ ...second, publisher: "Second publisher" }));
  expect(screen.getByTestId("panel-title").textContent).toBe("Second");
  expect(screen.getByTestId("opened-in-collection").textContent).toBe("true");
  await act(async () => firstRequest.resolve({ ...first, publisher: "First publisher" }));
  expect(screen.getByTestId("panel-title").textContent).toBe("Second");
});

it("cancels a pending hydration when the open panel is closed", async () => {
  api.root.mockReset(); api.collection.mockReset();
  const alreadyOpen = { id: 40, title: "Already open", author: "Author", read: false };
  const pendingTile = { id: 41, title: "Pending", author: "Author", read: false };
  const pending = deferred<any>();
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "book", book: alreadyOpen }, { kind: "book", book: pendingTile }], collections: [], books: [], total: 2 });
  api.getBook.mockResolvedValueOnce(alreadyOpen).mockReturnValueOnce(pending.promise);
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Already open"));
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Pending"));
  fireEvent.click(screen.getByText("Close selected book"));
  await act(async () => pending.resolve({ ...pendingTile, publisher: "Must not reopen" }));
  expect(screen.queryByTestId("book-panel")).toBeNull();
});

it("does not open an unsafe partial panel when book hydration fails", async () => {
  api.root.mockReset(); api.collection.mockReset();
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  const tile = { id: 50, title: "Unavailable", author: "Author", read: false };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "book", book: tile }], collections: [], books: [], total: 1 });
  api.getBook.mockRejectedValue(new Error("network"));
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Unavailable"));
  await act(async () => undefined);
  expect(screen.queryByTestId("book-panel")).toBeNull();
  expect(error).toHaveBeenCalled();
  error.mockRestore();
});

it("reconciles nested browse and the saved root snapshot after deletion", async () => {
  api.root.mockReset(); api.collection.mockReset(); api.getBook.mockReset();
  const deleted = { id: 61, title: "Delete me", author: "Author", read: false };
  const keepRoot = { id: 62, title: "Keep root", author: "Author", read: false };
  const keepNested = { id: 63, title: "Keep nested", author: "Author", read: false };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "collection", collection: root }, { kind: "book", book: deleted }, { kind: "book", book: keepRoot }], collections: [], books: [], total: 3 });
  api.collection.mockResolvedValue({ collection: root, collections: [], books: [deleted, keepNested], total: 2 });
  api.getBook.mockResolvedValue(deleted);
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Root"));
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Delete me"));
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Delete selected book"));
  await act(async () => undefined);
  expect(screen.queryByText("Delete me")).toBeNull();
  expect(screen.getByText("Keep nested")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Library" }));
  expect(screen.queryByText("Delete me")).toBeNull();
  expect(screen.getByText("Keep root")).toBeTruthy();
  expect(screen.getByText("Root")).toBeTruthy();
  expect(api.root).toHaveBeenCalledTimes(1);
});

it("removes a successfully deleted book from the current heterogeneous root browse", async () => {
  api.root.mockReset(); api.collection.mockReset(); api.getBook.mockReset();
  const deleted = { id: 71, title: "Delete root", author: "Author", read: false };
  const kept = { id: 72, title: "Keep root tile", author: "Author", read: false };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "collection", collection: root }, { kind: "book", book: deleted }, { kind: "book", book: kept }], collections: [], books: [], total: 3 });
  api.getBook.mockResolvedValue(deleted);
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Delete root"));
  await act(async () => undefined);
  fireEvent.click(screen.getByText("Delete selected book"));
  await act(async () => undefined);

  expect(screen.queryByText("Delete root")).toBeNull();
  expect(screen.getByText("Keep root tile")).toBeTruthy();
  expect(screen.getByText("Root")).toBeTruthy();
});

it("uses grouped books instead of root collection tiles and hydrates grouped opens outside Collection context", async () => {
  api.root.mockReset(); api.collection.mockReset(); api.grouped.mockReset(); api.getBook.mockReset();
  const groupedBook = { id: 81, title: "On the shelf", author: "Author", read: false, location_id: 9 };
  api.root.mockResolvedValue({ collection: null, items: [{ kind: "collection", collection: root }], collections: [], books: [], total: 1 });
  api.grouped.mockResolvedValue({ locations: [{ id: 9, name: "Shelf", books: [groupedBook], children: [] }], no_location: null });
  api.getBook.mockResolvedValue({ ...groupedBook, publisher: "Full record" });
  render(<App />);
  await act(async () => undefined);

  fireEvent.click(screen.getByLabelText("Group by Location"));
  await act(async () => undefined);
  expect(api.grouped).toHaveBeenCalledWith({ search: undefined, categoryId: undefined, locationId: undefined, read: undefined });
  expect(screen.queryByText("Root")).toBeNull();
  expect(screen.getByText("Shelf")).toBeTruthy();
  fireEvent.click(screen.getByText("On the shelf"));
  await act(async () => undefined);
  expect(api.getBook).toHaveBeenCalledWith(81);
  expect(screen.getByTestId("opened-in-collection").textContent).toBe("false");

  fireEvent.click(screen.getByLabelText("Group by Location"));
  expect(screen.getByText("Root")).toBeTruthy();
});

it("confirms and authoritatively assigns a suggested book to its exact Location", async () => {
  api.root.mockReset(); api.collection.mockReset(); api.grouped.mockReset();
  const suggestion = { id: 9, name: "Shelf G", path: [{ id: 1, name: "House" }, { id: 5, name: "Main Bookcase" }, { id: 9, name: "Shelf G" }] };
  const book = { id: 91, title: "The Shining", author: "Stephen King", publisher: "Doubleday", read: false, category_id: 4, location_id: null };
  api.root.mockResolvedValue({ collection: null, items: [], collections: [], books: [], total: 0 });
  api.grouped.mockResolvedValueOnce({ locations: [{ id: 9, name: "Shelf G", books: [], children: [] }], no_location: { name: "No Location", books: [{ ...book, suggested_locations: [suggestion] }] } }).mockResolvedValueOnce({ locations: [{ id: 9, name: "Shelf G", books: [{ ...book, location_id: 9 }], children: [] }], no_location: null });
  api.saveBook.mockResolvedValue({ ...book, location_id: 9 });
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByLabelText("Group by Location"));
  await act(async () => undefined);

  fireEvent.click(screen.getAllByText("The Shining").at(0)!);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Suggested placements for The Shining" })).toBeTruthy();
  expect(api.saveBook).not.toHaveBeenCalled();
  fireEvent.click(document.querySelector('[data-placement-option="9"]') as HTMLElement);
  expect(screen.getByRole("heading", { name: "Assign to Shelf G?" })).toBeTruthy();
  expect(screen.getByRole("dialog").textContent).toContain("The Shining");
  expect(screen.getByText("House → Main Bookcase → Shelf G")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Back to placements" }));
  expect(api.saveBook).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(api.saveBook).not.toHaveBeenCalled();

  fireEvent.click(screen.getAllByText("The Shining").at(0)!);
  fireEvent.click(document.querySelector('[data-placement-option="9"]') as HTMLElement);
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment to Shelf G" }));
  await act(async () => undefined);
  expect(api.saveBook).toHaveBeenCalledWith(expect.objectContaining({ id: 91, title: "The Shining", publisher: "Doubleday", category_id: 4, location_id: 9 }));
  expect(feedback.success).toHaveBeenCalledWith("Assigned to Shelf G");
  expect(api.grouped).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getAllByText("The Shining")).toHaveLength(1);
});

it("keeps the grouped result rendered while assignment waits for its authoritative refresh", async () => {
  api.root.mockReset(); api.collection.mockReset(); api.grouped.mockReset();
  const suggestion = { id: 9, name: "Shelf G", path: [{ id: 9, name: "Shelf G" }] };
  const book = { id: 93, title: "Stay visible", author: "Author", read: false, location_id: null };
  const refreshed = deferred<any>();
  api.root.mockResolvedValue({ collection: null, items: [], collections: [], books: [], total: 0 });
  api.grouped
    .mockResolvedValueOnce({ locations: [{ id: 9, name: "Shelf G", books: [], children: [] }], no_location: { name: "No Location", books: [{ ...book, suggested_locations: [suggestion] }] } })
    .mockReturnValueOnce(refreshed.promise);
  api.saveBook.mockResolvedValue({ ...book, location_id: 9 });
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByLabelText("Group by Location"));
  await act(async () => undefined);

  fireEvent.click(screen.getAllByText("Stay visible").at(0)!);
  fireEvent.click(document.querySelector('[data-placement-option="9"]') as HTMLElement);
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment to Shelf G" }));
  await act(async () => undefined);

  expect(api.grouped).toHaveBeenCalledTimes(2);
  expect(screen.getAllByText("Stay visible").length).toBeGreaterThan(0);

  await act(async () => refreshed.resolve({ locations: [{ id: 9, name: "Shelf G", books: [{ ...book, location_id: 9 }], children: [] }], no_location: null }));
  expect(screen.getByText("Stay visible")).toBeTruthy();
});

it("keeps the assignment confirmation open and reports an error when assignment fails", async () => {
  api.root.mockReset(); api.collection.mockReset(); api.grouped.mockReset();
  const suggestion = { id: 9, name: "Shelf G", path: [{ id: 9, name: "Shelf G" }] };
  const book = { id: 92, title: "Failure", author: "Author", read: false, location_id: null };
  api.root.mockResolvedValue({ collection: null, items: [], collections: [], books: [], total: 0 });
  api.grouped.mockResolvedValue({ locations: [{ id: 9, name: "Shelf G", books: [], children: [] }], no_location: { name: "No Location", books: [{ ...book, suggested_locations: [suggestion] }] } });
  api.saveBook.mockRejectedValue(new Error("network"));
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  render(<App />);
  await act(async () => undefined);
  fireEvent.click(screen.getByLabelText("Group by Location"));
  await act(async () => undefined);
  fireEvent.click(screen.getAllByText("Failure").at(0)!);
  fireEvent.click(document.querySelector('[data-placement-option="9"]') as HTMLElement);
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment to Shelf G" }));
  await act(async () => undefined);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(feedback.success).not.toHaveBeenCalled();
  expect(feedback.error).toHaveBeenCalledWith("Could not assign to Shelf G");
  error.mockRestore();
});
