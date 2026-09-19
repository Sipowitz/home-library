// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { BookListView } from "./BookListView";

it("dims, labels, and disables suggested rows without changing normal rows", () => {
  const onSelect = vi.fn();
  const suggested = { id: 1, title: "Suggested book", author: "Author", read: false, location_id: null };
  const normal = { id: 2, title: "Normal book", author: "Author", read: false, location_id: null };
  render(<BookListView books={[suggested, normal]} locations={[]} categories={[]} showCovers={false} suggestedBookIds={new Set([1])} onSelect={onSelect} />);

  const suggestedRow = screen.getByRole("button", { name: /suggested book/i });
  expect((suggestedRow as HTMLButtonElement).disabled).toBe(true);
  expect(suggestedRow.className).toContain("opacity-60");
  expect(within(suggestedRow).getAllByText("Suggested")).toHaveLength(2);
  fireEvent.click(suggestedRow);
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /normal book/i }));
  expect(onSelect).toHaveBeenCalledWith(normal);
});
