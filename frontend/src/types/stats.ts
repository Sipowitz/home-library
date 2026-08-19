export type StatItem = {
  name: string;
  count: number;
};

export type MonthlyStat = {
  month: string;
  count: number;
};

export type DailyBookStat = {
  date: string;
  added_books: number;
  read_books: number;
};

export type LibraryStats = {
  total_books: number;
  read_books: number;
  unread_books: number;
  by_category: StatItem[];
  by_location: StatItem[];
  recent_reads_7_days: number;
  recent_reads_30_days: number;
  recent_added_7_days: number;
  recent_added_30_days: number;
  monthly_reads: MonthlyStat[];
  books_over_time: DailyBookStat[];
};
