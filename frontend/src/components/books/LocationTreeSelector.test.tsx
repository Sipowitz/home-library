// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LocationTreeSelector } from "./LocationTreeSelector";

const locations = [{ id: 1, name: "Shelf", parent_id: null, child_count: 0, stats: { total_books: 0 }, children: [] }];

afterEach(cleanup);

it("uses -1 only for the Library No Location filter while Book Edit keeps null as unassigned", () => {
  const librarySelect = vi.fn();
  const editSelect = vi.fn();
  const { rerender } = render(<LocationTreeSelector locations={locations} selectedLocationId={null} onSelect={librarySelect} libraryFilter />);
  fireEvent.click(screen.getByRole("button", { name: /location/i }));
  fireEvent.click(screen.getByRole("button", { name: "No location" }));
  expect(librarySelect).toHaveBeenCalledWith(-1);

  rerender(<LocationTreeSelector locations={locations} selectedLocationId={1} onSelect={editSelect} />);
  fireEvent.click(screen.getByRole("button", { name: /location/i }));
  fireEvent.click(screen.getByRole("button", { name: "No location" }));
  expect(editSelect).toHaveBeenCalledWith(null);
});
