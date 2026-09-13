export type Series = {
  id: number;
  owner_id: number;
  name: string;
  node_type: "group" | "series";
  author: string | null;
  description: string | null;
  cover_url: string | null;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
};

export type SeriesTreeNode = Series & {
  children: SeriesTreeNode[];
};

export type SeriesWriteInput = {
  name: string;
  node_type?: "group" | "series";
  author?: string | null;
  description?: string | null;
  cover_url?: string | null;
  parent_id?: number | null;
};

export type SeriesUpdateInput = Partial<SeriesWriteInput>;

export type EffectiveSeriesMembership = {
  series_id: number;
  series_name: string;
};

export type EffectiveSeriesBook = {
  book_id: number;
  title: string;
  author: string;
  cover_url: string | null;
  isbn: string | null;
  year: number | null;
  direct: boolean;
  publication_order: number | null;
  chronological_order: number | null;
  root_publication_order: number | null;
  root_chronological_order: number | null;
  reading_order: number | null;
  reading_order_custom: boolean;
  explicit_memberships: EffectiveSeriesMembership[];
};

export type SeriesMembership = {
  book_id: number;
  series_id: number;
  created_at: string;
};

export type SeriesOrdering = {
  book_id: number;
  series_id: number;
  publication_order: number | null;
  chronological_order: number | null;
};
