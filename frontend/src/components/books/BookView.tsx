import React, { useMemo } from "react";

import { usePreferences } from "../../hooks/usePreferences";

import { formatDate } from "../../utils/dateFormatters";

import { buildTreeMap } from "../../utils/tree/buildTreeMap";

import { getTreePath } from "../../utils/tree/getTreePath";

import type { Book } from "../../types/book";

import type { Location } from "../../types/location";

import type { Category } from "../../types/category";

type Props = {
  book: Book;

  locations: Location[];

  categories: Category[];
};

function MetadataItem({
  label,
  value,
}: {
  label: string;

  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div
        className="
          text-[11px]
          uppercase
          tracking-[0.12em]
          text-gray-500
          mb-1
        "
      >
        {label}
      </div>

      <div
        className="
          text-sm
          text-gray-100
          break-words
          leading-relaxed
        "
      >
        {value}
      </div>
    </div>
  );
}

export function BookView({ book, locations, categories }: Props) {
  const { preferences } = usePreferences();

  // ================= LOCATION =================

  const locationMap = useMemo(() => buildTreeMap(locations), [locations]);

  const locationName = getTreePath(book.location_id, locationMap, "—");

  // ================= CATEGORY =================

  const categoryMap = useMemo(() => buildTreeMap(categories), [categories]);

  const categoryPath = book.category_id
    ? getTreePath(book.category_id, categoryMap, "—")
    : "—";

  // ================= IMAGE =================

  const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;

    if (!img.src.includes("fallback-cover.png")) {
      img.src = "/fallback-cover.png";
    }
  };

  return (
    <>
      {/* HEADER */}

      <div className="flex gap-6 mb-8">
        {/* LEFT COLUMN */}

        <div
          className="
            flex-shrink-0
            flex
            flex-col
            items-start
          "
        >
          <img
            src={
              book.cover_url ||
              "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
            }
            onError={handleImgError}
            className="
              w-36
              rounded-2xl
              shadow-2xl
              border border-gray-800
            "
          />

          {/* STATUS */}

          <div className="mt-4">
            <span
              className={`
                inline-flex
                items-center
                px-3 py-1.5
                rounded-xl
                text-xs
                font-medium
                border
                backdrop-blur-sm
                ${
                  book.read
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-200"
                    : "bg-gray-700/40 border-gray-600 text-gray-200"
                }
              `}
            >
              {book.read ? "Read" : "Unread"}
            </span>
          </div>
        </div>

        {/* RIGHT COLUMN */}

        <div className="flex-1 min-w-0">
          {/* TITLE BLOCK */}

          <div className="mb-6">
            <h2
              className="
                text-4xl
                font-bold
                leading-tight
                text-white
              "
            >
              {book.title}
            </h2>

            {book.subtitle && (
              <p
                className="
                  text-lg
                  text-gray-400
                  mt-2
                  leading-relaxed
                "
              >
                {book.subtitle}
              </p>
            )}

            <p
              className="
                text-xl
                text-gray-300
                mt-4
              "
            >
              {book.author}
            </p>
          </div>

          {/* PUBLISHING CARD */}

          <div
            className="
              bg-gray-900/35
              border border-gray-800
              rounded-2xl
              backdrop-blur-sm
              p-5
            "
          >
            <div
              className="
                grid
                grid-cols-1
                sm:grid-cols-2
                gap-x-8
                gap-y-5
              "
            >
              {/* COLLECTION */}

              <MetadataItem label="Location" value={locationName} />

              <MetadataItem label="Category" value={categoryPath} />

              {/* PUBLISHING */}

              {book.publisher && (
                <MetadataItem label="Publisher" value={book.publisher} />
              )}

              {book.year && (
                <MetadataItem label="Published" value={book.year} />
              )}

              {/* FORMAT */}

              {book.page_count && (
                <MetadataItem label="Pages" value={book.page_count} />
              )}

              {book.language && (
                <MetadataItem label="Language" value={book.language} />
              )}

              {/* IDENTIFIERS */}

              {book.isbn && <MetadataItem label="ISBN" value={book.isbn} />}

              {book.date_added && (
                <MetadataItem
                  label="Added"
                  value={formatDate(book.date_added, preferences)}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DESCRIPTION */}

      {book.description && (
        <div
          className="
            border-t border-gray-800
            pt-6
          "
        >
          <h3
            className="
              text-sm
              font-semibold
              tracking-wide
              text-white
              mb-4
            "
          >
            Description
          </h3>

          <div
            className="
              bg-gray-900/25
              border border-gray-800
              rounded-2xl
              p-5
            "
          >
            <p
              className="
                text-sm
                leading-8
                text-gray-300
                whitespace-pre-line
              "
            >
              {book.description}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
