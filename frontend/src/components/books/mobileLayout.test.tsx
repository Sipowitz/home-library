// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AddBookForm } from "./AddBookForm";
import { MetadataComparisonPanel } from "./MetadataComparisonPanel";

const fetchMetadataCandidates = vi.hoisted(() => vi.fn());

vi.mock("../../hooks/useISBNScanner", () => ({
  useISBNScanner: () => ({
    scannerOpen: false,
    setScannerOpen: vi.fn(),
    torchOn: false,
    torchSupported: false,
    toggleTorch: vi.fn(),
    stopScanner: vi.fn(),
  }),
}));
vi.mock("../../api/metadataCandidates", () => ({ fetchMetadataCandidates }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("stacks Add Book actions below the small breakpoint", () => {
  render(
    <AddBookForm
      newBook={{}}
      setNewBook={vi.fn()}
      onSearch={vi.fn()}
      onAdd={vi.fn().mockResolvedValue(undefined)}
      onAddReview={vi.fn().mockResolvedValue(undefined)}
      canAddReview={false}
      onReset={vi.fn()}
      onISBNChange={vi.fn()}
      isFetching={false}
    />,
  );

  const actions = screen.getByRole("button", { name: "Start Over" }).parentElement;
  expect(actions?.classList.contains("flex-col")).toBe(true);
  expect(actions?.classList.contains("sm:flex-row")).toBe(true);
});

it("uses a single-column metadata row before the small breakpoint", async () => {
  fetchMetadataCandidates.mockResolvedValue([
    {
      provider: "google_books",
      success: true,
      isbn: "9780306406157",
      duration_ms: 1,
      data: { title: "A mobile-safe title" },
      error: null,
    },
  ]);

  render(<MetadataComparisonPanel bookId={1} currentData={{}} />);

  await waitFor(() => expect(screen.queryAllByText("Google Books").length).toBeGreaterThan(0));
  const row = screen.getAllByText("Google Books")[0].parentElement;
  expect(row?.classList.contains("grid-cols-1")).toBe(true);
  expect(row?.classList.contains("sm:grid-cols-[180px_minmax(0,1fr)_120px]")).toBe(true);
});
