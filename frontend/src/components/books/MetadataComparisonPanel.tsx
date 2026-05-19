import { useEffect, useState } from "react";

import { fetchMetadataCandidates } from "../../api/metadataCandidates";

import type { ProviderResult } from "../../types/provider";

type Props = {
  bookId: number;
};

export function MetadataComparisonPanel({ bookId }: Props) {
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

  if (!providers.length) {
    return (
      <div className="text-sm text-gray-400">No provider metadata found.</div>
    );
  }

  return (
    <div className="space-y-5">
      {/* HEADER */}

      <div>
        <h3 className="text-lg font-semibold">Metadata Comparison</h3>

        <p className="text-sm text-gray-400 mt-1">
          Compare metadata and covers returned by all enabled providers.
        </p>
      </div>

      {/* PROVIDER GRID */}

      <div
        className="
          grid
          grid-cols-1
          xl:grid-cols-2
          gap-5
        "
      >
        {providers.map((provider) => {
          const data = provider.data || {};

          const coverCandidates = data.cover_candidates || [];

          return (
            <div
              key={provider.provider}
              className="
                rounded-2xl
                border border-gray-800
                bg-gray-900/60
                p-5
                space-y-5
              "
            >
              {/* PROVIDER HEADER */}

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-4
                "
              >
                <div>
                  <h4
                    className="
                      font-semibold
                      text-lg
                      capitalize
                    "
                  >
                    {provider.provider.replace("_", " ")}
                  </h4>

                  <p className="text-xs text-gray-400 mt-1">
                    {provider.duration_ms}
                    ms
                  </p>
                </div>

                <div>
                  {provider.success ? (
                    <span
                      className="
                        text-xs
                        px-2 py-1
                        rounded-full
                        bg-green-500/20
                        text-green-300
                      "
                    >
                      Success
                    </span>
                  ) : (
                    <span
                      className="
                        text-xs
                        px-2 py-1
                        rounded-full
                        bg-red-500/20
                        text-red-300
                      "
                    >
                      Failed
                    </span>
                  )}
                </div>
              </div>

              {/* PRIMARY COVER */}

              {data.cover_url && (
                <div>
                  <p
                    className="
                      text-xs
                      text-gray-500
                      mb-2
                    "
                  >
                    Selected Cover
                  </p>

                  <img
                    src={data.cover_url}
                    alt={data.title}
                    className="
                      w-full
                      h-72
                      object-contain
                      rounded-xl
                      bg-black/30
                    "
                  />
                </div>
              )}

              {/* COVER CANDIDATES */}

              {!!coverCandidates.length && (
                <div>
                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      mb-3
                    "
                  >
                    <p
                      className="
                        text-xs
                        text-gray-500
                      "
                    >
                      Cover Candidates
                    </p>

                    <span
                      className="
                        text-xs
                        text-gray-400
                      "
                    >
                      {coverCandidates.length} covers
                    </span>
                  </div>

                  <div
                    className="
                      flex
                      gap-3
                      overflow-x-auto
                      pb-2
                    "
                  >
                    {coverCandidates.map((candidate: any, index: number) => (
                      <div
                        key={`${candidate.url}-${index}`}
                        className="
                            min-w-[120px]
                            space-y-2
                          "
                      >
                        <img
                          src={candidate.url}
                          alt={`Cover ${index}`}
                          className="
                              w-[120px]
                              h-[180px]
                              object-cover
                              rounded-lg
                              border border-gray-700
                              bg-black/30
                            "
                        />

                        <div
                          className="
                              text-xs
                              text-center
                              text-gray-400
                            "
                        >
                          {candidate.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* METADATA */}

              <div className="space-y-3">
                <MetadataField label="Title" value={data.title} />

                <MetadataField label="Subtitle" value={data.subtitle} />

                <MetadataField label="Author" value={data.author} />

                <MetadataField label="Publisher" value={data.publisher} />

                <MetadataField label="Page Count" value={data.page_count} />

                <MetadataField label="Language" value={data.language} />

                <MetadataField label="Year" value={data.year} />

                <div>
                  <p
                    className="
                      text-xs
                      text-gray-500
                      mb-1
                    "
                  >
                    Description
                  </p>

                  <div
                    className="
                      text-sm
                      text-gray-300
                      max-h-48
                      overflow-y-auto
                      rounded-lg
                      bg-black/20
                      p-3
                    "
                  >
                    {data.description || "—"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type MetadataFieldProps = {
  label: string;

  value: any;
};

function MetadataField({ label, value }: MetadataFieldProps) {
  return (
    <div>
      <p
        className="
          text-xs
          text-gray-500
          mb-1
        "
      >
        {label}
      </p>

      <div
        className="
          text-sm
          text-gray-200
          break-words
        "
      >
        {value || "—"}
      </div>
    </div>
  );
}
