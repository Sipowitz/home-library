// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { fetchMetadataCandidates } from "../../api/metadataCandidates";

import { MetadataComparisonPanel } from "./MetadataComparisonPanel";

vi.mock("../../api/metadataCandidates", () => ({ fetchMetadataCandidates: vi.fn() }));

const candidates = [
  {
    provider: "openlibrary", success: true, isbn: "9780306406157", duration_ms: 1, error: null,
    data: { title: "Saved title", subtitle: "Open subtitle", author: "Open author", publisher: "Open publisher", page_count: 100, language: "rus", year: 2000, description: "Open description" },
  },
  {
    provider: "google_books", success: true, isbn: "9780306406157", duration_ms: 1, error: null,
    data: { title: "Google title", subtitle: "Google subtitle", author: "Google author", publisher: "Google publisher", page_count: 200, language: "en", year: 2001, description: "Google description" },
  },
];

const currentData = {
  title: "Saved title", subtitle: "Open subtitle", author: "Open author", publisher: "Open publisher",
  page_count: 100, language: "rus", year: 2000, description: "Open description",
};

function providerButton(field: string, provider: string) {
  const category = screen.getByRole("heading", { name: field }).parentElement?.parentElement;
  return within(within(category!).getByText(provider).parentElement!).getByRole("button");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("keeps default selections, allows one category to be deselected, and excludes it from Done", async () => {
  vi.mocked(fetchMetadataCandidates).mockResolvedValue(candidates);
  const apply = vi.fn();
  render(<MetadataComparisonPanel bookId={1} currentData={currentData} onApplySelectedMetadata={apply} />);

  await waitFor(() => expect(providerButton("Language", "Openlibrary").textContent).toBe("Selected"));
  expect(providerButton("Language", "Google Books").textContent).toBe("Select");

  fireEvent.click(providerButton("Language", "Openlibrary"));
  expect(providerButton("Language", "Openlibrary").textContent).toBe("Select");
  expect(providerButton("Language", "Google Books").textContent).toBe("Select");
  expect(providerButton("Title", "Openlibrary").textContent).toBe("Selected");

  fireEvent.click(screen.getByRole("button", { name: "Done — Mark Metadata Reviewed" }));
  expect(apply).toHaveBeenCalledWith({});
});

it("switches providers and applies the newly selected value when marking metadata reviewed", async () => {
  vi.mocked(fetchMetadataCandidates).mockResolvedValue(candidates);
  const apply = vi.fn();
  render(<MetadataComparisonPanel bookId={1} currentData={currentData} onApplySelectedMetadata={apply} />);

  await waitFor(() => expect(providerButton("Language", "Google Books").textContent).toBe("Select"));
  fireEvent.click(providerButton("Language", "Google Books"));
  expect(providerButton("Language", "Google Books").textContent).toBe("Selected");
  expect(providerButton("Language", "Openlibrary").textContent).toBe("Select");

  fireEvent.click(screen.getByRole("button", { name: "Done — Mark Metadata Reviewed" }));
  expect(apply).toHaveBeenCalledWith({ language: "en" });
});
