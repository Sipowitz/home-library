// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("../../hooks/useOverlayScrollLock", () => ({ useOverlayScrollLock: vi.fn() }));
import { SuggestedLocationAssignmentDialog } from "./SuggestedLocationAssignmentDialog";

const existing = (id: number, position: number) => ({ id, title: `Book ${position}`, author: `Author ${position}`, cover_url: `/covers/${id}.jpg`, location_id: 1, location_position: position });
const options = [
  { id: 1, name: "Middle Shelf", path: [{ id: 1, name: "Middle Shelf" }], before: [existing(11, 12), existing(12, 13)], after: [existing(13, 14), existing(14, 15)] },
  { id: 2, name: "Beginning Shelf", path: [{ id: 2, name: "Beginning Shelf" }], before: [], after: [existing(21, 1), existing(22, 2)] },
  { id: 3, name: "End Shelf", path: [{ id: 3, name: "End Shelf" }], before: [existing(31, 23), existing(32, 24)], after: [] },
  { id: 4, name: "Short Shelf", path: [{ id: 4, name: "Short Shelf" }], before: [existing(41, 1)], after: [] },
];
const book = { id: 99, title: "New title", author: "New author", cover_url: "/covers/new.jpg", location_id: null, suggested_locations: options };
const callbacks = () => ({ onClose: vi.fn(), onSelectLocation: vi.fn(), onBack: vi.fn(), onConfirm: vi.fn(), onViewBook: vi.fn() });
afterEach(cleanup);

it("shows every placement with real positions and at most two neighbours on each side", () => {
  const actions = callbacks();
  render(<SuggestedLocationAssignmentDialog assignment={{ book, location: null }} assigning={false} {...actions} />);
  const placements = screen.getAllByRole("button", { name: /Select this placement/ });
  expect(placements).toHaveLength(4);
  expect(Array.from(placements[0].querySelectorAll("[data-placement-book]")).map((item) => item.getAttribute("data-placement-book"))).toEqual(["11", "12", "new", "13", "14"]);
  expect(within(placements[0]).getByText("#12")).toBeTruthy();
  expect(within(placements[0]).getByText("#15")).toBeTruthy();
  expect(Array.from(placements[1].querySelectorAll("[data-placement-book]")).map((item) => item.getAttribute("data-placement-book"))).toEqual(["new", "21", "22"]);
  expect(Array.from(placements[2].querySelectorAll("[data-placement-book]")).map((item) => item.getAttribute("data-placement-book"))).toEqual(["31", "32", "new"]);
  expect(Array.from(placements[3].querySelectorAll("[data-placement-book]")).map((item) => item.getAttribute("data-placement-book"))).toEqual(["41", "new"]);
  for (const placement of placements) {
    const newBook = placement.querySelector('[data-placement-book="new"]') as HTMLElement;
    expect(within(newBook).getByText("NEW BOOK")).toBeTruthy();
    expect(newBook.textContent).not.toMatch(/#\d+/);
  }
  fireEvent.click(placements[2]);
  expect(actions.onSelectLocation).toHaveBeenCalledWith(options[2]);
  expect(actions.onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "View book" }));
  expect(actions.onViewBook).toHaveBeenCalledTimes(1);
});

it("requires an explicit confirmation and permits backing out", () => {
  const actions = callbacks();
  const { rerender } = render(<SuggestedLocationAssignmentDialog assignment={{ book, location: null }} assigning={false} {...actions} />);
  fireEvent.click(screen.getAllByRole("button", { name: /Select this placement/ })[0]);
  expect(actions.onConfirm).not.toHaveBeenCalled();
  rerender(<SuggestedLocationAssignmentDialog assignment={{ book, location: options[0] }} assigning={false} {...actions} />);
  fireEvent.click(screen.getByRole("button", { name: "Back to placements" }));
  expect(actions.onBack).toHaveBeenCalled();
  expect(actions.onConfirm).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm assignment to Middle Shelf" }));
  expect(actions.onConfirm).toHaveBeenCalledTimes(1);
});
