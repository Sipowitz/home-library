// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Header } from "./Header";

it("contains a long library name without allowing it to grow past the action buttons", () => {
  render(<Header libraryName={"A very long library name that should stay contained on mobile"} onOpenSettings={vi.fn()} onLogout={vi.fn()} />);

  expect(screen.getByText(/A very long library name/).classList.contains("truncate")).toBe(true);
  expect(screen.getByRole("heading").classList.contains("min-w-0")).toBe(true);
  expect(screen.getByRole("heading").classList.contains("flex-1")).toBe(true);
});
