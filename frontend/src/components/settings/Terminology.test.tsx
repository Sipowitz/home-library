// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const api = vi.hoisted(() => ({
  fetchTree: vi.fn(),
  fetchBooks: vi.fn(),
  create: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("../../api/series", () => ({
  fetchSeriesTree: api.fetchTree,
  fetchEffectiveSeriesBooks: api.fetchBooks,
  createSeries: api.create,
  deleteSeries: vi.fn(),
  updateSeries: vi.fn(),
  uploadSeriesCover: vi.fn(),
  addSeriesMembership: vi.fn(),
  removeSeriesMembership: vi.fn(),
  replaceReadingOrder: vi.fn(),
  replaceRootOrder: vi.fn(),
  resetReadingOrder: vi.fn(),
  seriesApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("../../api/books", () => ({ getBooks: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { success: api.toastSuccess, error: api.toastError } }));
vi.mock("../../hooks/usePreferences", () => ({ usePreferences: () => ({
  loading: false,
  preferences: {
    library_name: "Library",
    show_collections_in_library: true,
    root_collection_display_mode: "collections_only",
    show_stats_desktop: true,
    show_stats_mobile: true,
  },
  updatePreferences: vi.fn(),
}) }));

import { SettingsSidebar } from "./SettingsSidebar";
import { LibrarySettings } from "./LibrarySettings";
import { SeriesSettings } from "./series/SeriesSettings";
import { SeriesBooksSection } from "./series/SeriesBooksSection";

beforeEach(() => {
  api.fetchTree.mockReset();
  api.fetchBooks.mockReset();
  api.create.mockReset();
  api.toastSuccess.mockReset();
  api.toastError.mockReset();
});

afterEach(cleanup);

it("uses Collections for generic Settings navigation and the Library preference", () => {
  render(<><SettingsSidebar active="series" onChange={vi.fn()} isAdmin /><LibrarySettings /></>);
  expect(screen.getAllByRole("button", { name: "Collections" }).length).toBeGreaterThan(0);
  expect(screen.getByText("Show root Collections alongside your Library book grid.")).toBeTruthy();
  expect(screen.queryByText("Show root Groups and Series alongside your Library book grid.")).toBeNull();
});

it("uses Collection-neutral empty and creation feedback while retaining the Group and Series root choices", async () => {
  api.fetchTree.mockResolvedValue([]);
  api.create.mockResolvedValue({ id: 1, name: "History", node_type: "group" });
  render(<SeriesSettings />);

  expect(await screen.findByText("No Collections yet")).toBeTruthy();
  expect(screen.queryByText("No Series yet")).toBeNull();
  fireEvent.click(screen.getAllByRole("button", { name: "Create" }).at(-1)!);
  expect(screen.getByRole("button", { name: "Group" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Series" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Group" }));
  fireEvent.change(screen.getByLabelText(/Name/), { target: { value: "History" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Create" }).at(-1)!);
  await waitFor(() => expect(api.toastSuccess).toHaveBeenCalledWith("Collection created"));
});

it("uses Collection-neutral book membership empty and error states", async () => {
  api.fetchBooks.mockResolvedValue([]);
  const view = render(<SeriesBooksSection seriesId={1} seriesName="History" nodeType="group" isRoot onMembershipsChanged={vi.fn()} />);
  expect(await screen.findByText("No books belong to this Collection yet.")).toBeTruthy();
  view.unmount();

  api.fetchBooks.mockRejectedValue(new Error("network"));
  render(<SeriesBooksSection seriesId={2} seriesName="History" nodeType="series" isRoot onMembershipsChanged={vi.fn()} />);
  expect((await screen.findByRole("alert")).textContent).toContain("Unable to load Collection books.");
});
