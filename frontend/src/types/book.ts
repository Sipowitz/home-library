import type { Category } from "./category";

export type Book = {
  id: number;
  title: string;
  author: string;

  year?: number;

  isbn?: string;

  description?: string;

  read?: boolean;

  read_at?: string | null;

  location_id?: number;

  cover_url?: string;

  // ✅ single category
  category_id?: number | null;

  // optional expanded object (if used anywhere)
  category?: Category | null;

  date_added?: string;

  warning?: string;
};

export type BookDraft = Partial<Book>;
