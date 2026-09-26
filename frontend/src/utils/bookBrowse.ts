import type { Book } from "../types/book";
import type { Category } from "../types/category";
import type { Location } from "../types/location";

export type BrowseFilters = {
  search?: string;
  locationId?: number | null;
  categoryId?: number | null;
  read?: boolean | null;
};

function inTree(id: number | null | undefined, selectedId: number, nodes: Array<Category | Location>): boolean {
  if (id == null) return false;
  if (id === selectedId) return true;
  const byId = new Map<number, Category | Location>();
  const visit = (items: Array<Category | Location>) => items.forEach((node) => {
    byId.set(node.id, node);
    if (node.children?.length) visit(node.children);
  });
  visit(nodes);
  let current = byId.get(id);
  while (current?.parent_id != null) {
    if (current.parent_id === selectedId) return true;
    current = byId.get(current.parent_id);
  }
  return false;
}

function ilikeContains(value: string, search: string): boolean {
  // Backend queries use ILIKE with the search embedded between two % wildcards.
  const pattern = `%${search}%`;
  let regex = "";
  let escaped = false;
  for (const char of pattern) {
    if (escaped) {
      regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      escaped = false;
    } else if (char === "\\") {
      escaped = true;
    } else if (char === "%") {
      regex += "[\\s\\S]*";
    } else if (char === "_") {
      regex += "[\\s\\S]";
    } else {
      regex += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${regex}$(?![\\s\\S])`, "iu").test(value);
}

export function bookMatchesFilters(
  book: Book,
  filters: BrowseFilters,
  locations: Location[],
  categories: Category[],
  searchMode: "raw" | "trimmed" = "raw",
): boolean {
  if (filters.locationId != null && (filters.locationId === -1
    ? book.location_id != null
    : !inTree(book.location_id, filters.locationId, locations))) return false;
  if (filters.categoryId != null && (filters.categoryId === -1
    ? book.category_id != null
    : !inTree(book.category_id, filters.categoryId, categories))) return false;
  if (filters.read != null && Boolean(book.read) !== filters.read) return false;
  const search = searchMode === "trimmed" ? filters.search?.trim() : filters.search;
  return !search || ilikeContains(book.title, search) || ilikeContains(book.author, search);
}

export function authorSurname(author: string): string {
  return author.split(" ").at(-1) ?? "";
}

export function compareBookSurnames(a: Pick<Book, "author" | "id">, b: Pick<Book, "author" | "id">): number {
  return authorSurname(a.author).localeCompare(authorSurname(b.author)) || a.id - b.id;
}
