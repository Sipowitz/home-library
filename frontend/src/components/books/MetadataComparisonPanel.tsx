import { useEffect, useMemo, useState } from "react";

import { RefreshCw, X } from "lucide-react";

import { fetchMetadataCandidates } from "../../api/metadataCandidates";

import type { ProviderResult } from "../../types/provider";

import { resolveCoverUrl } from "./BookView";

type Props = {
  bookId: number;

  currentData?: Record<string, any>;

  onApplySelectedMetadata?: (selections: Record<string, any>) => void;

  onClose?: () => void;

  onRefreshMetadata?: () => Promise<ProviderResult[] | void>;

  isRefreshing?: boolean;

  coverUrl?: string;
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

function mergeProviderResults(
  previous: ProviderResult[],
  refreshed: ProviderResult[],
): ProviderResult[] {
  const merged = new Map(previous.map((result) => [result.provider, result]));

  for (const result of refreshed) {
    if (result.success && result.data) {
      merged.set(result.provider, result);
    } else if (!merged.has(result.provider)) {
      merged.set(result.provider, result);
    }
  }

  return Array.from(merged.values());
}

function formatProviderName(name: string) {
  return name.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MetadataComparisonPanel({
  bookId,
  currentData,
  onApplySelectedMetadata,
  onClose,
  onRefreshMetadata,
  isRefreshing = false,
  coverUrl,
}: Props) {
  const [providers, setProviders] = useState<ProviderResult[]>([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [selections, setSelections] = useState<Record<string, any>>({});

  const [isApplying, setIsApplying] = useState(false);

  const [failedBackdropUrl, setFailedBackdropUrl] = useState<string | null>(null);

  const resolvedCoverUrl = resolveCoverUrl(coverUrl);

  const handleRefresh = async () => {
    if (!onRefreshMetadata || isRefreshing) return;

    const results = await onRefreshMetadata();

    if (results) {
      const mergedResults = mergeProviderResults(providers, results);
      setProviders(mergedResults);
      setSelections((current) => {
        const available = new Set(
          mergedResults.flatMap((provider) =>
            provider.success && provider.data
              ? FIELDS.map((field) => field.key + ":" + String(provider.data?.[field.key]))
              : [],
          ),
        );
        return Object.fromEntries(
          Object.entries(current).filter(([field, value]) =>
            available.has(field + ":" + String(value)),
          ),
        );
      });
    }
  };

  const applicableSelections = Object.fromEntries(
    Object.entries(selections).filter(([field, value]) => currentData?.[field] !== value),
  );

  const handleApply = () => {
    if (isApplying || !Object.keys(applicableSelections).length) return;

    setIsApplying(true);
    onApplySelectedMetadata?.(applicableSelections);
  };

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);

        setError(null);

        const results = await fetchMetadataCandidates(bookId);

        if (!mounted) return;

        setProviders(results);
        setSelections((current) => {
          if (Object.keys(current).length) return current;

          return Object.fromEntries(
            FIELDS.flatMap((field) => {
              const match = results.find(
                (provider) =>
                  provider.success &&
                  provider.data &&
                  provider.data[field.key] === currentData?.[field.key],
              );
              return match ? [[field.key, match.data?.[field.key]]] : [];
            }),
          );
        });
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
          relative
          isolate
          flex
          flex-col
          overflow-hidden
          rounded-3xl
          border border-white/10
          bg-[#071421]/90
          shadow-2xl
        "
      >
        {resolvedCoverUrl && failedBackdropUrl !== resolvedCoverUrl && (
          <img
            src={resolvedCoverUrl}
            alt=""
            aria-hidden="true"
            onError={() => setFailedBackdropUrl(resolvedCoverUrl)}
            className="pointer-events-none absolute -inset-2 z-0 h-[calc(100%+1rem)] w-[calc(100%+1rem)] object-cover object-[center_34%] opacity-80 blur-[4px] md:object-[center_40%]"
          />
        )}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[#06111e]/75 via-[#071421]/82 to-[#071421]/92" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#06101c]/70 via-black/5 to-black/20" />

        <div className="relative z-20 min-h-0 flex-1 overflow-y-auto">

        {/* HEADER */}

        <div
          className="
            relative z-20
            flex flex-wrap items-start justify-between
            gap-4
            border-b border-white/10
            bg-[#071421]/90
            px-6 py-5
            backdrop-blur
          "
        >
          <div className="min-w-0">
            <h2 className="text-2xl font-semibold text-white">
              Metadata Comparison
            </h2>

            <p className="mt-1 text-sm text-gray-400">
              Compare provider metadata and adopt values.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={!onRefreshMetadata || isRefreshing}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 px-4 text-sm font-medium text-violet-200 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Refreshing..." : "Refresh Metadata"}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close metadata comparison"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-gray-200 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CONTENT */}

        <div className="relative z-20 space-y-10 p-6">
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
                    const selected = Object.prototype.hasOwnProperty.call(selections, field.key)
                      ? selections[field.key] === entry.value
                      : currentData?.[field.key] === entry.value;

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
                          ${selected ? "bg-blue-500/10" : "bg-[#071421]/55"}
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
                              setSelections((current) => ({
                                ...current,
                                [field.key]: entry.value,
                              }))
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

        <div className="sticky bottom-0 z-20 flex justify-end border-t border-white/10 bg-[#071421]/90 px-6 py-4 backdrop-blur">
          <button
            type="button"
            onClick={handleApply}
            disabled={!onApplySelectedMetadata || !Object.keys(applicableSelections).length || isApplying}
            className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isApplying ? "Applying..." : "Apply Selected Metadata"}
          </button>
        </div>
      </div>
    </div>
  );
}
