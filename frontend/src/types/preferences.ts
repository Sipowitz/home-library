export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";

export type TimeFormat = "24h" | "12h";

export type LibraryViewMode = "grid" | "list";

export type AppearanceMode = "system" | "light" | "dark";

export type EffectiveTheme = "light" | "dark";
export type RootCollectionDisplayMode = "collections_only" | "collections_and_books";

export type Preferences = {
  id: number;

  user_id: number;

  date_format: DateFormat;

  time_format: TimeFormat;

  library_view_mode: LibraryViewMode;

  show_covers_in_list: boolean;

  show_stats_desktop: boolean;

  show_stats_mobile: boolean;

  appearance_mode: AppearanceMode;

  library_name: string;
  show_collections_in_library: boolean;
  root_collection_display_mode: RootCollectionDisplayMode;

  created_at: string;

  updated_at: string;
};

export type PreferencesUpdate = {
  library_name?: string;
  date_format?: DateFormat;

  time_format?: TimeFormat;

  library_view_mode?: LibraryViewMode;

  show_covers_in_list?: boolean;

  show_stats_desktop?: boolean;

  show_stats_mobile?: boolean;

  appearance_mode?: AppearanceMode;
  show_collections_in_library?: boolean;
  root_collection_display_mode?: RootCollectionDisplayMode;
};
