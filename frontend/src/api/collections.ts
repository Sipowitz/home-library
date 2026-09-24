import client from "./client";
import type { Series } from "../types/series";
import type { Book } from "../types/book";

export type CollectionBrowseBook = Pick<Book, "id" | "title" | "author" | "cover_url" | "read"> & {
  publication_order: number | null;
  chronological_order: number | null;
  reading_order: number | null;
};

export type CollectionBrowseResult = {
  collection: Series | null;
  items: CollectionBrowseItem[];
  collections: Series[];
  books: CollectionBrowseBook[];
  total: number;
};

export type CollectionBrowseItem =
  | { kind: "book"; book: CollectionBrowseBook }
  | { kind: "collection"; collection: Series };

export type BrowseOptions = { search?: string; categoryId?: number | null; locationId?: number | null; read?: boolean | null; sort?: "reading" | "publication" | "chronological" | "alphabetical"; rootMode?: "collections_only" | "collections_and_books"; skip?: number; limit?: number };

function params(options: BrowseOptions) {
  return { search: options.search || undefined, category_id: options.categoryId ?? undefined, location_id: options.locationId ?? undefined, read: options.read ?? undefined, sort: options.sort, root_mode: options.rootMode, skip: options.skip, limit: options.limit ?? 100 };
}

export async function browseRootCollections(options: BrowseOptions): Promise<CollectionBrowseResult> {
  return (await client.get<CollectionBrowseResult>("/series/browse", { params: params(options) })).data;
}

export async function browseCollection(id: number, options: BrowseOptions): Promise<CollectionBrowseResult> {
  return (await client.get<CollectionBrowseResult>(`/series/${id}/browse`, { params: params(options) })).data;
}
