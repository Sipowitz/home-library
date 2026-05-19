import { useEffect, useMemo, useState } from "react";

import { fetchMetadataCandidates } from "../../api/metadataCandidates";

import type { ProviderResult } from "../../types/provider";

type Props = {
  bookId: number;

  currentData?: Record<string, any>;

  onAdoptField?: (field: string, value: any) => void;
};

const FIELDS = [
  {
    key: "title",
    label: "Title",
  },

  {
    key: "subtitle",
    label: "Subtitle",
  },

  {
    key: "author",
    label: "Author",
  },

  {
    key: "publisher",
    label: "Publisher",
  },

  {
    key: "page_count",
    label: "Page Count",
  },

  {
    key: "language",
    label: "Language",
  },

  {
    key: "year",
    label: "Year",
  },

  {
    key: "description",
    label: "Description",
  },
];

export function MetadataComparisonPanel({
  bookId,
  currentData,
  onAdoptField,
}: Props) {
  const [providers, setProviders] = useState<ProviderResult[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        setError(null);

        const results = await fetchMetadataCandidates(bookId);

        if (!mounted) return;

        setProviders(results);
      } catch (err) {
        console.error(err);

        setError("Failed to load metadata candidates");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [bookId]);

  const successfulProviders = useMemo(
    () => providers.filter((p) => p.success && p.data),
    [providers],
  );

  if (loading) {
    return (
      <div className="text-sm text-gray-400">
        Loading metadata candidates...
      </div>
    );
  }

  if (error) {
    return <div className="text-sm text-red-400">{error}</div>;
  }

  if (!successfulProviders.length) {
    return (
      <div className="text-sm text-gray-400">No provider metadata found.</div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}

      <div>
        <h3 className="text-lg font-semibold">Metadata Comparison</h3>

        <p className="text-sm text-gray-400 mt-1">
          Compare and adopt metadata values from providers.
        </p>
      </div>

      {/* FIELD MATRIX */}

      <div className="space-y-8">
        {FIELDS.map((field) => {
          const values = successfulProviders.map((provider) => ({
            provider: provider.provider,

            value: provider.data?.[field.key],
          }));

          const uniqueValues = new Set(
            values.map((v) => String(v.value ?? "")),
          );

          const hasConflict = uniqueValues.size > 1;

          return (
            <div
              key={field.key}
              className="
                border border-gray-800
                rounded-2xl
                overflow-hidden
              "
            >
              {/* FIELD HEADER */}

              <div
                className={`
                  px-4 py-3
                  border-b border-gray-800
                  flex
                  items-center
                  justify-between
                  ${hasConflict ? "bg-amber-500/10" : "bg-gray-900/40"}
                `}
              >
                <div>
                  <div className="font-medium">{field.label}</div>

                  <div
                    className="
                      text-xs
                      text-gray-400
                      mt-1
                    "
                  >
                    {hasConflict
                      ? "Provider values differ"
                      : "All providers agree"}
                  </div>
                </div>

                {currentData?.[field.key] && (
                  <div
                    className="
                      text-xs
                      text-blue-400
                    "
                  >
                    Current value set
                  </div>
                )}
              </div>

              {/* VALUES */}

              <div
                className="
                  divide-y divide-gray-800
                "
              >
                {values.map((entry, index) => {
                  const selected = currentData?.[field.key] === entry.value;

                  return (
                    <button
                      key={`${field.key}-${entry.provider}-${index}`}
                      type="button"
                      onClick={() => onAdoptField?.(field.key, entry.value)}
                      className={`
                          w-full
                          text-left
                          px-4 py-4
                          transition
                          hover:bg-gray-800/40
                          ${selected ? "bg-blue-500/10" : ""}
                        `}
                    >
                      <div
                        className="
                            flex
                            items-start
                            justify-between
                            gap-4
                          "
                      >
                        <div
                          className="
                              min-w-[120px]
                              text-sm
                              font-medium
                              capitalize
                              text-gray-300
                            "
                        >
                          {entry.provider.replace("_", " ")}
                        </div>

                        <div
                          className="
                              flex-1
                              text-sm
                              text-gray-200
                              whitespace-pre-wrap
                              break-words
                            "
                        >
                          {entry.value || "—"}
                        </div>

                        <div
                          className="
                              flex-shrink-0
                            "
                        >
                          {selected ? (
                            <div
                              className="
                                  text-xs
                                  text-blue-400
                                  font-medium
                                "
                            >
                              Selected
                            </div>
                          ) : (
                            <div
                              className="
                                  text-xs
                                  text-gray-500
                                "
                            >
                              Click to adopt
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
