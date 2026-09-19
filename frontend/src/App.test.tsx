// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ root: vi.fn(), collection: vi.fn(), grouped: vi.fn(), getBook: vi.fn(), saveBook: vi.fn() }));
const feedback = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("./api/collections", () => ({ browseRootCollections: api.root, browseCollection: api.collection }));
vi.mock("./hooks/useBooks", () => ({ useBooks: () => ({ books: [], loadMoreBooks: vi.fn(), hasMore: false, addBook: vi.fn(), addBookFromISBN: vi.fn(), removeBook: vi.fn(), saveBook: api.saveBook, updateFilters: vi.fn(), isLoading: false, loadError: null, filters: {} }) }));
vi.mock("./context/LocationContext", () => ({ useLocations: () => ({ locations: [] }) }));
vi.mock("./context/CategoryContext", () => ({ useCategories: () => ({ categories: [] }) }));
vi.mock("./context/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true, login: vi.fn(), logout: vi.fn() }) }));
vi.mock("./hooks/usePreferences", () => ({ usePreferences: () => ({ preferences: { library_name: "Library", library_view_mode: "grid", show_collections_in_library: true, root_collection_display_mode: "collections_only" }, updatePreferences: vi.fn() }) }));
vi.mock("./hooks/useSearch", () => ({ useSearch: () => ({ searchInput: "", setSearchInput: vi.fn() }) }));
vi.mock("./hooks/useBookActions", () => ({ useBookActions: (params: any) => ({ isFetching: false, handleSearch: vi.fn(), handleAddBook: vi.fn(), handleQuickAdd: vi.fn(), handleAddAndReview: vi.fn(), handleDelete: async (id: number) => { await params.removeBook(id); params.reconcileDeletedBook(id); params.setSelectedBook(null); }, handleSave: vi.fn(), resetAddBook: vi.fn(), handleAddBookISBNChange: vi.fn() }) }));
vi.mock("./api/books", () => ({ getBook: api.getBook, getGroupedBooks: api.grouped }));
vi.mock("./api/auth", () => ({ login: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: feedback }));
vi.mock("./components/books/views/BookGridView", () => ({ BookGridView: ({ items, collections, books, onSelectCollection, onSelect, suggestedBookIds, suggestedLocationsByBookId, onSuggestedSelect }: any) => <div data-testid="grid">{(items ?? [
  ...(collections ?? []).map((collection: any) => ({ kind: "collection", collection })),
  ...(books ?? []).map((book: any) => ({ kind: "book", book })),
]).map((item: any) => item.kind === "collection"
  ? <button key={`collection-${item.collection.id}`} onClick={() => onSelectCollection?.(item.collection)}>{item.collection.name}</button>
  : <button key={`book-${item.book.id}`} onClick={() => suggestedBookIds?.has(item.book.id) ? onSuggestedSelect?.(item.book, suggestedLocationsByBookId?.get(item.book.id)) : onSelect?.(item.book)}>{item.book.title}</button>)}</div> }));
vi.mock("./components/layout/Header", () => ({ Header: () => null }));
vi.mock("./components/layout/TopPanels", () => ({ TopPanels: () => null }));
vi.mock("./components/search/SearchBar", () => ({ SearchBar: () => null }));
vi.mock("./components/books/views/ViewModeSwitcher", () => ({ ViewModeSwitcher: () => null }));
vi.mock("./components/settings/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("./components/books/BookPanel", () => ({ BookPanel: ({ book, openedInCollection, editing, editData, setEditing, setEditData, onClose, onDelete }: any) => <section data-testid="book-panel"><span data-testid="panel-title">{book.title}</span><span data-testid="opened-in-collection">{String(openedInCollection)}</span><span data-testid="panel-publisher">{book.publisher}</span><span data-testid="panel-location">{book.location_id}</span><span data-testid="panel-category">{book.category_id}</span><button onClick={() => { setEditData(book); setEditing(true); }}>Edit selected book</button><button onClick={onClose}>Close selected book</button><button onClick={() => void onDelete(book.id)}>Delete selected book</button>{editing && <><span data-testid="edit-publisher">{editData?.publisher}</span><span data-testid="edit-year">{editData?.year}</span><span data-testid="edit-language">{editData?.language}</span><span data-testid="edit-pages">{editData?.page_count}</span><span data-testid="edit-isbn">{editData?.isbn}</span><span data-testid="edit-description">{editData?.description}</span><span data-testid="edit-location">{editData?.location_id}</span><span data-testid="edit-category">{editData?.category_id}</span></>}</section> }));
vi.mock("./components/settings/maintenance/MaintenanceReviewSession", () => ({ MaintenanceReviewSession: () => null }));
vi.mock("./components/books/AddBookDialog", () => ({ AddBookDialog: () => null }));
vi.mock("./components/books/CheckLibraryDialog", () => ({ CheckLibraryDialog: () => null }));

import App from "./App";

function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>((done) => { resolve = done; }), resolve }; }
const root = { id: 1, name: "Root", node_type: "series", author: null, description: null, cover_url: null, parent_id: null };
const nested = { ...root, id: 2, name: "Nested", parent_id: 1 };

beforeEach(() => {
  api.getBook.mockReset();
  api.saveBook.mockReset();
  feedback.success.mockReset();
  feedback.error.mockReset();
});

afterEach(() => {
  cleanup();
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
  expect(screen.getByRole("heading", { name: "Assign to Shelf G?" })).toBeTruthy();
  expect(screen.getByRole("dialog").textContent).toContain("The Shining");
  expect(screen.getByText("House → Main Bookcase → Shelf G")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(api.saveBook).not.toHaveBeenCalled();

  fireEvent.click(screen.getAllByText("The Shining").at(0)!);
  fireEvent.click(screen.getByRole("button", { name: "Assign to Shelf G" }));
  await act(async () => undefined);
  expect(api.saveBook).toHaveBeenCalledWith(expect.objectContaining({ id: 91, title: "The Shining", publisher: "Doubleday", category_id: 4, location_id: 9 }));
  expect(feedback.success).toHaveBeenCalledWith("Assigned to Shelf G");
  expect(api.grouped).toHaveBeenCalledTimes(2);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getAllByText("The Shining")).toHaveLength(1);
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
  fireEvent.click(screen.getByRole("button", { name: "Assign to Shelf G" }));
  await act(async () => undefined);
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(feedback.success).not.toHaveBeenCalled();
  expect(feedback.error).toHaveBeenCalledWith("Could not assign to Shelf G");
  error.mockRestore();
});
