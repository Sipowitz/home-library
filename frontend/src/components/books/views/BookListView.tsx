import { useMemo } from "react";

import type { Book } from "../../../types/book";
import type { Location } from "../../../types/location";
import type { Category } from "../../../types/category";

type Props = {
  books: Book[];

  locations: Location[];

  categories: Category[];

  showCovers: boolean;

  onSelect: (book: Book) => void;
};

// ====================
// 🌲 FLATTEN HELPERS
// ====================

function flattenLocations(
  nodes: Location[],
  result: Location[] = [],
): Location[] {
  for (const node of nodes) {
    result.push(node);

    if (node.children?.length) {
      flattenLocations(node.children, result);
    }
  }

  return result;
}

function flattenCategories(
  nodes: Category[],
  result: Category[] = [],
): Category[] {
  for (const node of nodes) {
    result.push(node);

    if (node.children?.length) {
      flattenCategories(node.children, result);
    }
  }

  return result;
}

// ====================
// 📍 PATH HELPERS
// ====================

function getLocationPath(
  id: number | null | undefined,
  map: Map<number, Location>,
): string {
  if (!id) return "—";

  const path: string[] = [];

  let current = map.get(id);

  while (current) {
    path.unshift(current.name);

    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }

  return path.join(" → ");
}

function getCategoryPath(
  id: number | null | undefined,
  map: Map<number, Category>,
): string {
  if (!id) return "—";

  const path: string[] = [];

  let current = map.get(id);

  while (current) {
    path.unshift(current.name);

    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }

  return path.join(" → ");
}

// ====================
// 📚 COMPONENT
// ====================

export function BookListView({
  books,
  locations,
  categories,
  showCovers,
  onSelect,
}: Props) {
  const locationMap = useMemo(() => {
    const flat = flattenLocations(locations);

    return new Map(flat.map((l) => [l.id, l]));
  }, [locations]);

  const categoryMap = useMemo(() => {
    const flat = flattenCategories(categories);

    return new Map(flat.map((c) => [c.id, c]));
  }, [categories]);

  return (
    <div
      className="
        rounded-2xl
        border border-gray-800
        overflow-hidden
        bg-gray-900/40
        backdrop-blur-sm
      "
    >
      {/* HEADER */}
      <div
        className="
          hidden md:grid
          items-center
          gap-4
          px-4 py-3
          bg-gray-900/95
          border-b border-gray-800
          text-xs uppercase tracking-wide
          text-gray-400
        "
        style={{
          gridTemplateColumns: showCovers
            ? "72px 2fr 1.5fr 2fr 2fr 90px 80px"
            : "2fr 1.5fr 2fr 2fr 90px 80px",
        }}
      >
        {showCovers && <div>Cover</div>}

        <div>Title</div>

        <div>Author</div>

        <div>Location</div>

        <div>Category</div>

        <div>Year</div>

        <div>Status</div>
      </div>

      {/* ROWS */}
      <div>
        {books.map((book) => {
          const locationPath = getLocationPath(book.location_id, locationMap);

          const categoryPath = getCategoryPath(book.category_id, categoryMap);

          return (
            <button
              key={book.id}
              type="button"
              onClick={() => onSelect(book)}
              className="
                w-full
                text-left
                border-b border-gray-800/70
                hover:bg-gray-800/40
                transition
              "
            >
              {/* DESKTOP */}
              <div
                className="
                  hidden md:grid
                  items-center
                  gap-4
                  px-4 py-3
                "
                style={{
                  gridTemplateColumns: showCovers
                    ? "72px 2fr 1.5fr 2fr 2fr 90px 80px"
                    : "2fr 1.5fr 2fr 2fr 90px 80px",
                }}
              >
                {/* COVER */}
                {showCovers && (
                  <div>
                    {book.cover_url ? (
                      <img
                        src={book.cover_url}
                        className="
                          w-14 h-20
                          rounded-lg
                          object-cover
                          shadow
                        "
                        onError={(e) => {
                          const img = e.currentTarget;

                          img.style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="
                          w-14 h-20
                          rounded-lg
                          bg-gray-800
                          border border-gray-700
                          flex items-center justify-center
                          text-[10px]
                          text-gray-500
                        "
                      >
                        No Cover
                      </div>
                    )}
                  </div>
                )}

                {/* TITLE */}
                <div className="min-w-0">
                  <div className="font-medium text-white truncate">
                    {book.title}
                  </div>

                  {book.isbn && (
                    <div className="text-xs text-gray-500 mt-1 truncate">
                      ISBN: {book.isbn}
                    </div>
                  )}
                </div>

                {/* AUTHOR */}
                <div className="text-sm text-gray-300 truncate">
                  {book.author}
                </div>

                {/* LOCATION */}
                <div className="text-sm text-gray-400 truncate">
                  {locationPath}
                </div>

                {/* CATEGORY */}
                <div className="text-sm text-gray-400 truncate">
                  {categoryPath}
                </div>

                {/* YEAR */}
                <div className="text-sm text-gray-300">{book.year || "—"}</div>

                {/* STATUS */}
                <div>
                  <span
                    className={`
                      inline-flex
                      items-center
                      justify-center
                      min-w-[64px]
                      px-2 py-1
                      rounded-lg
                      text-xs font-medium
                      ${
                        book.read
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                          : "bg-gray-700/60 text-gray-300 border border-gray-600"
                      }
                    `}
                  >
                    {book.read ? "Read" : "Unread"}
                  </span>
                </div>
              </div>

              {/* MOBILE */}
              <div className="md:hidden p-4">
                <div className="flex gap-4">
                  {showCovers && (
                    <div className="shrink-0">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          className="
                            w-16 h-24
                            rounded-lg
                            object-cover
                          "
                        />
                      ) : (
                        <div
                          className="
                            w-16 h-24
                            rounded-lg
                            bg-gray-800
                            border border-gray-700
                          "
                        />
                      )}
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white">{book.title}</div>

                    <div className="text-sm text-gray-400 mt-1">
                      {book.author}
                    </div>

                    <div className="text-xs text-gray-500 mt-3 line-clamp-1">
                      {locationPath}
                    </div>

                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">
                      {categoryPath}
                    </div>

                    <div className="mt-3">
                      <span
                        className={`
                          inline-flex
                          items-center
                          px-2 py-1
                          rounded-lg
                          text-[11px]
                          ${
                            book.read
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-gray-700 text-gray-300"
                          }
                        `}
                      >
                        {book.read ? "Read" : "Unread"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
