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
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Metadata Comparison</h3>

        <p className="text-sm text-gray-400 mt-1">
          Compare metadata returned by all enabled providers.
        </p>
      </div>

      <div
        className="
          grid
          grid-cols-1
          lg:grid-cols-2
          gap-4
        "
      >
        {providers.map((provider) => {
          const data = provider.data || {};

          return (
            <div
              key={provider.provider}
              className="
                rounded-xl
                border border-gray-800
                bg-gray-900/60
                p-4
                space-y-4
              "
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                "
              >
                <div>
                  <h4 className="font-semibold capitalize">
                    {provider.provider.replace("_", " ")}
                  </h4>

                  <p className="text-xs text-gray-400">
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

              {data.cover_url && (
                <img
                  src={data.cover_url}
                  alt={data.title}
                  className="
                    w-full
                    h-64
                    object-contain
                    rounded-lg
                    bg-black/30
                  "
                />
              )}

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Title</p>

                  <p className="text-sm">{data.title || "—"}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Author</p>

                  <p className="text-sm">{data.author || "—"}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Year</p>

                  <p className="text-sm">{data.year || "—"}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">Description</p>

                  <p
                    className="
                      text-sm
                      text-gray-300
                      max-h-48
                      overflow-y-auto
                    "
                  >
                    {data.description || "—"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
