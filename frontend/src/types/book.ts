import type { Category } from "./category";

export type CoverCandidate = {
  provider: string;

  label: string;

  url: string;
};

export type Book = {
  id: number;

  title: string;

  author: string;

  subtitle?: string;

  publisher?: string;

  language?: string;

  page_count?: number;

  year?: number;

  isbn?: string;

  description?: string;

  read?: boolean;

  read_at?: string | null;

  location_id?: number | null;

  cover_url?: string;

  uploaded_cover_candidates_json?: CoverCandidate[];

  // ✅ single category
  category_id?: number | null;

  // optional expanded object (if used anywhere)
  category?: Category | null;

  date_added?: string;

  last_metadata_refresh_at?: string | null;

  warning?: string;
};

export type BookDraft = Partial<Book>;
