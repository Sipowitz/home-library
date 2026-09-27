// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Header } from "./Header";

afterEach(cleanup);

it("contains a long library name without allowing it to grow past the action buttons", () => {
  render(<Header libraryName={"A very long library name that should stay contained on mobile"} onOpenSettings={vi.fn()} onLogout={vi.fn()} />);

  expect(screen.getByText(/A very long library name/).classList.contains("truncate")).toBe(true);
  expect(screen.getByRole("heading").classList.contains("min-w-0")).toBe(true);
  expect(screen.getByRole("heading").classList.contains("flex-1")).toBe(true);
});

it("gives icon-only header actions accessible names and tooltips", () => {
  render(<Header libraryName="Library" onOpenSettings={vi.fn()} onLogout={vi.fn()} />);

  expect(screen.getByRole("button", { name: "Open settings" }).getAttribute("title")).toBe("Open settings");
  expect(screen.getByRole("button", { name: "Log out" }).getAttribute("title")).toBe("Log out");
});
