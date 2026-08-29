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
