import { useEffect, useMemo, useState } from "react";

import { fetchMetadataCandidates } from "../../api/metadataCandidates";

import type { ProviderResult } from "../../types/provider";

type Props = {
  bookId: number;

  currentData?: Record<string, any>;

  onAdoptField?: (field: string, value: any) => void;

  onClose?: () => void;
};

const FIELDS = [
  { key: "title", label: "Title" },
  { key: "subtitle", label: "Subtitle" },
  { key: "author", label: "Author" },
  { key: "publisher", label: "Publisher" },
  { key: "page_count", label: "Page Count" },
  { key: "language", label: "Language" },
  { key: "year", label: "Year" },
  { key: "description", label: "Description" },
];

function formatProviderName(name: string) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MetadataComparisonPanel({
  bookId,
  currentData,
  onAdoptField,
  onClose,
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
      <div className="p-6 text-sm text-gray-400">
        Loading metadata candidates...
      </div>
    );
  }

  if (error) {
    return <div className="p-6 text-sm text-red-400">{error}</div>;
  }

  if (!successfulProviders.length) {
    return (
      <div className="p-6 text-sm text-gray-400">
        No provider metadata found.
      </div>
    );
  }

  return (
    <div
      className="
        fixed inset-0 z-[60]
        flex items-center justify-center
        bg-black/60 backdrop-blur-sm
      "
    >
      <div
        className="
          w-[900px]
          max-w-[95vw]
          max-h-[90vh]
          overflow-y-auto
          rounded-3xl
          border border-gray-800
          bg-gray-950
          shadow-2xl
        "
      >
        {/* HEADER */}

        <div
          className="
            sticky top-0 z-10
            flex items-center justify-between
            border-b border-gray-800
            bg-gray-950/95
            px-6 py-5
            backdrop-blur
          "
        >
          <div>
            <h2 className="text-2xl font-semibold text-white">
              Metadata Comparison
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Compare provider metadata and adopt values.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="
              rounded-xl
              border border-gray-700
              px-3 py-2
              text-sm text-gray-300
              transition
              hover:border-gray-500
              hover:bg-gray-800
              hover:text-white
            "
          >
            Close
          </button>
        </div>

        {/* CONTENT */}

        <div className="space-y-10 p-6">
          {FIELDS.map((field) => {
            const values = successfulProviders.map((provider) => ({
              provider: provider.provider,

              value: provider.data?.[field.key],
            }));

            return (
              <div key={field.key}>
                {/* FIELD TITLE */}

                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-white">
                    {field.label}
                  </h3>
                </div>

                {/* ROWS */}

                <div
                  className="
                    overflow-hidden
                    rounded-2xl
                    border border-gray-800
                  "
                >
                  {values.map((entry, index) => {
                    const selected = currentData?.[field.key] === entry.value;

                    return (
                      <div
                        key={`${field.key}-${entry.provider}-${index}`}
                        className={`
                          grid
                          grid-cols-[180px_1fr_120px]
                          items-start
                          gap-4
                          border-b border-gray-800
                          px-5 py-4
                          transition
                          last:border-b-0
                          ${selected ? "bg-blue-500/10" : "bg-transparent"}
                        `}
                      >
                        {/* PROVIDER */}

                        <div
                          className="
                            text-sm
                            font-medium
                            text-gray-300
                          "
                        >
                          {formatProviderName(entry.provider)}
                        </div>

                        {/* VALUE */}

                        <div
                          className="
                            text-sm
                            text-gray-100
                            whitespace-pre-wrap
                            break-words
                          "
                        >
                          {entry.value || (
                            <span className="text-gray-500">—</span>
                          )}
                        </div>

                        {/* ACTION */}

                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() =>
                              onAdoptField?.(field.key, entry.value)
                            }
                            className={`
                              rounded-xl
                              px-3 py-2
                              text-sm
                              font-medium
                              transition
                              ${
                                selected
                                  ? `
                                    bg-blue-500/20
                                    text-blue-300
                                    border border-blue-500/30
                                  `
                                  : `
                                    border border-gray-700
                                    text-gray-400
                                    hover:border-blue-500/30
                                    hover:bg-blue-500/10
                                    hover:text-blue-300
                                  `
                              }
                            `}
                          >
                            {selected ? "Selected" : "Select"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
