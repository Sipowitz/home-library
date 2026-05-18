export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export type TimeFormat = "24h" | "12h";

export type LibraryViewMode = "grid" | "list";

export type Preferences = {
  id: number;

  user_id: number;

  date_format: DateFormat;

  time_format: TimeFormat;

  library_view_mode: LibraryViewMode;

  show_covers_in_list: boolean;

  created_at: string;

  updated_at: string;
};

export type PreferencesUpdate = {
  date_format?: DateFormat;

  time_format?: TimeFormat;

  library_view_mode?: LibraryViewMode;

  show_covers_in_list?: boolean;
};
