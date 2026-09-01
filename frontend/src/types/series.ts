export type Series = {
  id: number;
  owner_id: number;
  name: string;
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
  author?: string | null;
  description?: string | null;
  parent_id?: number | null;
};

export type SeriesUpdateInput = Partial<SeriesWriteInput>;

export type EffectiveSeriesMembership = {
  series_id: number;
  series_name: string;
  node_order: string | null;
};

export type EffectiveSeriesBook = {
  book_id: number;
  title: string;
  author: string;
  cover_url: string | null;
  isbn: string | null;
  year: number | null;
  direct: boolean;
  node_order: string | null;
  publication_order: string | null;
  chronological_order: string | null;
  explicit_memberships: EffectiveSeriesMembership[];
};

export type SeriesMembership = {
  book_id: number;
  series_id: number;
  node_order: string | null;
  created_at: string;
};

export type SeriesOrdering = {
  book_id: number;
  series_id: number;
  publication_order: string | null;
  chronological_order: string | null;
};
