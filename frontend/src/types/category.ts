export type CategoryStats = {
  total_books: number;

  read_books: number;

  unread_books: number;
};

export type Category = {
  id: number;

  name: string;

  parent_id?: number | null;

  children?: Category[];

  stats: CategoryStats;
};
