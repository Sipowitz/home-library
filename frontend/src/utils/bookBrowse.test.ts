import { describe, expect, it } from "vitest";
import type { Book } from "../types/book";
import { bookMatchesFilters } from "./bookBrowse";

const book: Book = { id: 1, title: "Alpha Beta", author: "Ada Lovelace" };
const matches = (search: string, searchMode: "raw" | "trimmed" = "raw", candidate = book) =>
  bookMatchesFilters(candidate, { search }, [], [], searchMode);

describe("local browse search reconciliation", () => {
  it("matches ordinary text in either title or author without regard to case", () => {
    expect(matches("alpha")).toBe(true);
    expect(matches("LOVELACE")).toBe(true);
    expect(matches("missing")).toBe(false);
  });

  it("keeps normal and Out of Library search raw, but trims Collection search", () => {
    expect(matches("  Alpha  ")).toBe(false);
    expect(matches("  Alpha  ", "trimmed")).toBe(true);
    expect(matches("   ")).toBe(false);
    expect(matches("   ", "trimmed")).toBe(true);
  });

  it("treats percent as a zero-or-more-character ILIKE wildcard", () => {
    expect(matches("Al%ta")).toBe(true);
    expect(matches("Al%ma")).toBe(false);
    expect(matches("%", "trimmed")).toBe(true);
  });

  it("treats underscore as an exactly-one-character ILIKE wildcard", () => {
    expect(matches("Al_ha")).toBe(true);
    expect(matches("Al_ha", "raw", { ...book, title: "Alha", author: "Other" })).toBe(false);
    expect(matches("Al_ha", "raw", { ...book, title: "Alxxha", author: "Other" })).toBe(false);
    expect(matches("Al_ha", "raw", { ...book, title: "Al😀ha", author: "Other" })).toBe(true);
  });

  it("keeps ILIKE's backslash escape for literal wildcard characters", () => {
    expect(matches("100\\%", "raw", { ...book, title: "100% Done", author: "Other" })).toBe(true);
    expect(matches("100\\%", "raw", { ...book, title: "100 Books", author: "Other" })).toBe(false);
  });
});
