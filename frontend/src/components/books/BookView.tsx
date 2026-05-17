import React, { useMemo } from "react";

import { usePreferences } from "../../hooks/usePreferences";

import { formatDate } from "../../utils/dateFormatters";

import type { Book } from "../../types/book";
import type { Location } from "../../types/location";
import type { Category } from "../../types/category";

type Props = {
  book: Book;

  locations: Location[];

  categories: Category[];
};

export function BookView({ book, locations, categories }: Props) {
  const { preferences } = usePreferences();

  // -------------------
  // 📍 LOCATION HELPERS
  // -------------------

  function flattenLocationTree(nodes: Location[]): Location[] {
    let result: Location[] = [];

    for (const node of nodes) {
      result.push(node);

      if (node.children?.length) {
        result = result.concat(flattenLocationTree(node.children));
      }
    }

    return result;
  }

  const locationMap = useMemo(() => {
    const flat = flattenLocationTree(locations);

    return new Map(flat.map((l) => [l.id, l]));
  }, [locations]);

  function getLocationPath(id?: number | null): string {
    if (!id) return "";

    let current = locationMap.get(id);

    const path: string[] = [];

    while (current) {
      path.unshift(current.name);

      current = current.parent_id
        ? locationMap.get(current.parent_id)
        : undefined;
    }

    return path.join(" > ");
  }

  // -------------------
  // 🏷 CATEGORY HELPERS
  // -------------------

  function flattenCategoryTree(nodes: Category[]): Category[] {
    let result: Category[] = [];

    for (const node of nodes) {
      result.push(node);

      if (node.children?.length) {
        result = result.concat(flattenCategoryTree(node.children));
      }
    }

    return result;
  }

  const categoryMap = useMemo(() => {
    const flat = flattenCategoryTree(categories);

    return new Map(flat.map((c) => [c.id, c]));
  }, [categories]);

  function getCategoryPath(id: number): string {
    let current = categoryMap.get(id);

    const path: string[] = [];

    while (current) {
      path.unshift(current.name);

      current = current.parent_id
        ? categoryMap.get(current.parent_id)
        : undefined;
    }

    return path.join(" > ");
  }

  const locationName = getLocationPath(book.location_id);

  const categoryPath = book.category_id
    ? getCategoryPath(book.category_id)
    : null;

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;

    if (!img.src.includes("fallback-cover.png")) {
      img.src = "/fallback-cover.png";
    }
  };

  return (
    <>
      {/* HEADER */}
      <div className="flex gap-4 mb-4">
        <img
          src={
            book.cover_url ||
            "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
          }
          onError={handleImgError}
          className="w-32 rounded shadow"
        />

        <div className="flex-1">
          <h2 className="text-xl font-bold">{book.title}</h2>

          <p className="text-gray-400 mb-2">{book.author}</p>

          <span
            className={`text-xs px-2 py-1 rounded ${
              book.read ? "bg-green-600" : "bg-gray-700"
            }`}
          >
            {book.read ? "Read" : "Unread"}
          </span>
        </div>
      </div>

      {/* METADATA */}
      <div className="mb-4 text-sm space-y-2 border-t border-gray-800 pt-3">
        <div>
          <strong>Location:</strong> {locationName || "—"}
        </div>

        {categoryPath && (
          <div>
            <strong>Category:</strong> {categoryPath}
          </div>
        )}

        {book.isbn && (
          <div>
            <strong>ISBN:</strong> {book.isbn}
          </div>
        )}

        {book.year && (
          <div>
            <strong>Year:</strong> {book.year}
          </div>
        )}

        {book.date_added && (
          <div>
            <strong>Added:</strong> {formatDate(book.date_added, preferences)}
          </div>
        )}
      </div>

      {/* DESCRIPTION */}
      {book.description && (
        <div className="mb-4 border-t border-gray-800 pt-3">
          <h3 className="text-sm font-semibold mb-1">Description</h3>

          <p className="text-sm text-gray-300 whitespace-pre-line">
            {book.description}
          </p>
        </div>
      )}
    </>
  );
}
