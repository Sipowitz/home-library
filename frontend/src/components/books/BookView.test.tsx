// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({
  getCollectionPaths: vi.fn(),
  getBook: vi.fn(),
  getCoverCandidates: vi.fn().mockResolvedValue({ candidates: [] }),
  refreshMetadata: vi.fn(),
  selectCoverCandidate: vi.fn(),
}));
vi.mock("../../hooks/usePreferences", () => ({ usePreferences: () => ({ preferences: {} }) }));
vi.mock("../../context/PreferencesContext", () => ({ usePreferencesContext: () => ({ preferences: {} }) }));
vi.mock("../../api/metadataCandidates", () => ({ fetchMetadataCandidates: vi.fn().mockResolvedValue([]) }));
vi.mock("../../api/books", () => ({
  getBookCollectionPaths: api.getCollectionPaths,
  getBook: api.getBook,
  getCoverCandidates: api.getCoverCandidates,
  refreshMetadata: api.refreshMetadata,
  selectCoverCandidate: api.selectCoverCandidate,
}));

import { BookView } from "./BookView";
import { BookEdit } from "./BookEdit";

const book = { id: 1, title: "Book One", author: "Author One", read: false };
const otherBook = { id: 2, title: "Book Two", author: "Author Two", read: false };

function deferred<T>() {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve };
}

beforeEach(() => {
  api.getCollectionPaths.mockReset();
});

it("omits Collections when an owned book has no memberships", async () => {
  api.getCollectionPaths.mockResolvedValue([]);
  render(<BookView book={book} locations={[]} categories={[]} />);

  await waitFor(() => expect(api.getCollectionPaths).toHaveBeenCalledWith(book.id));
  expect(screen.queryByText("Collections")).toBeNull();
});

it("renders root and nested Collection paths without structural terminology", async () => {
  api.getCollectionPaths.mockResolvedValue([
    { nodes: [{ id: 1, name: "Discworld" }] },
    { nodes: [{ id: 2, name: "Wilbur Smith" }, { id: 3, name: "Courtneys" }] },
  ]);
  render(<BookView book={book} locations={[]} categories={[]} />);

  expect(await screen.findByText("Collections")).toBeTruthy();
  expect(screen.getByLabelText("Discworld")).toBeTruthy();
  expect(screen.getByLabelText("Wilbur Smith then Courtneys")).toBeTruthy();
  expect(screen.getAllByText("›").length).toBeGreaterThan(0);
  expect(screen.queryByText("Group")).toBeNull();
  expect(screen.queryByText("Series")).toBeNull();
});

it("reports the already-loaded read-only Collection paths to its parent", async () => {
  const paths = [{ nodes: [{ id: 1, name: "Collection" }] }];
  const onCollectionPathsChange = vi.fn();
  api.getCollectionPaths.mockResolvedValue(paths);
  render(<BookView book={book} locations={[]} categories={[]} onCollectionPathsChange={onCollectionPathsChange} />);

  await waitFor(() => expect(onCollectionPathsChange).toHaveBeenLastCalledWith(paths));
});

it("renders each long, deep Collection path as a separate readable list item", async () => {
  api.getCollectionPaths.mockResolvedValue([
    { nodes: [{ id: 1, name: "A very long root Collection name" }, { id: 2, name: "A deeply nested Collection" }, { id: 3, name: "The final Collection" }] },
    { nodes: [{ id: 4, name: "Another Collection" }, { id: 5, name: "Its child" }] },
  ]);
  const { container } = render(<BookView book={book} locations={[]} categories={[]} />);

  expect(await screen.findByLabelText("A very long root Collection name then A deeply nested Collection then The final Collection")).toBeTruthy();
  expect(screen.getByLabelText("Another Collection then Its child")).toBeTruthy();
  expect(container.querySelectorAll('li[aria-label*="then"]')).toHaveLength(2);
});

it("does not render a stale Collection response after the Book View switches books", async () => {
  const first = deferred<any[]>();
  const second = deferred<any[]>();
  api.getCollectionPaths.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const view = render(<BookView book={book} locations={[]} categories={[]} />);
  view.rerender(<BookView book={otherBook} locations={[]} categories={[]} />);

  await act(async () => second.resolve([{ nodes: [{ id: 20, name: "New Collection" }] }]));
  expect(screen.getByLabelText("New Collection")).toBeTruthy();
  await act(async () => first.resolve([{ nodes: [{ id: 10, name: "Stale Collection" }] }]));
  expect(screen.queryByLabelText("Stale Collection")).toBeNull();
});

it("keeps Book View available when Collection-path loading fails", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  api.getCollectionPaths.mockRejectedValue(new Error("network"));
  const { container } = render(<BookView book={book} locations={[]} categories={[]} />);

  await waitFor(() => expect(error).toHaveBeenCalled());
  expect(container.querySelector("h2")?.textContent).toBe("Book One");
  expect(Array.from(container.querySelectorAll("div")).some((element) => element.textContent === "Collections")).toBe(false);
  error.mockRestore();
});

it("does not add Collection membership controls to Book Edit", () => {
  const { container } = render(
    <BookEdit
      editData={book}
      setEditData={vi.fn()}
      categories={[]}
      locations={[]}
      textareaRef={createRef<HTMLTextAreaElement>()}
      onSave={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

  expect(Array.from(container.querySelectorAll("label")).some((element) => /collection/i.test(element.textContent ?? ""))).toBe(false);
  expect(container.querySelector('[aria-label*="collection" i]')).toBeNull();
});
