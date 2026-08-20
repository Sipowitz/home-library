import { useMemo, useState, type ReactNode } from "react";

import {
  Barcode,
  BookOpen,
  Building2,
  CalendarDays,
  Check,
  Clock3,
  Folder,
  Languages,
  MapPin,
  Pencil,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { usePreferences } from "../../hooks/usePreferences";
import { formatDate, formatDateTime } from "../../utils/dateFormatters";
import { buildTreeMap } from "../../utils/tree/buildTreeMap";
import { getTreePath } from "../../utils/tree/getTreePath";

import type { Book } from "../../types/book";
import type { Location } from "../../types/location";
import type { Category } from "../../types/category";

type Props = {
  book: Book;
  locations: Location[];
  categories: Category[];
  onEdit: () => void;
};

type HeroFact = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
};

type LibraryFact = HeroFact;

const FALLBACK_COVER = "/fallback-cover.png";

function resolveCoverUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed, window.location.origin).toString();
  } catch {
    return null;
  }
}

function HeroMetadata({ fact }: { fact: HeroFact }) {
  const Icon = fact.icon;

  return (
    <div className="flex min-w-0 items-start gap-3 md:border-r md:border-white/15 md:pr-5 last:md:border-r-0 last:md:pr-0">
      <Icon size={18} className="mt-0.5 shrink-0 text-gray-200" aria-hidden="true" />
      <div className="min-w-0">
        <div className="break-words text-sm font-medium leading-5 text-white">
          {fact.value}
        </div>
        <div className="mt-0.5 text-[11px] text-gray-400">{fact.label}</div>
      </div>
    </div>
  );
}

function LibraryDetail({ fact }: { fact: LibraryFact }) {
  const Icon = fact.icon;

  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-white/[0.06] py-3 first:pt-0 last:border-b-0 last:pb-0">
      <Icon size={17} className="mt-0.5 shrink-0 text-blue-300" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{fact.label}</div>
        <div className="mt-0.5 break-words text-sm leading-5 text-gray-100">
          {fact.value}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-3 text-lg font-semibold text-white">
      <Icon size={21} className="text-blue-400" aria-hidden="true" />
      {children}
    </h3>
  );
}

export function BookView({ book, locations, categories, onEdit }: Props) {
  const { preferences } = usePreferences();
  const [failedForegroundUrl, setFailedForegroundUrl] = useState<string | null>(null);
  const [failedBackdropUrl, setFailedBackdropUrl] = useState<string | null>(null);

  const locationMap = useMemo(() => buildTreeMap(locations), [locations]);
  const categoryMap = useMemo(() => buildTreeMap(categories), [categories]);

  const locationPath = book.location_id
    ? getTreePath(book.location_id, locationMap, "")
    : "";
  const categoryPath = book.category_id
    ? getTreePath(book.category_id, categoryMap, "")
    : "";

  const resolvedCoverUrl = resolveCoverUrl(book.cover_url);
  const foregroundUrl =
    resolvedCoverUrl && failedForegroundUrl !== resolvedCoverUrl
      ? resolvedCoverUrl
      : FALLBACK_COVER;
  const showBackdrop = Boolean(
    resolvedCoverUrl && failedBackdropUrl !== resolvedCoverUrl,
  );

  const heroFacts = ([
    book.year ? { label: "Published", value: book.year, icon: CalendarDays } : null,
    book.publisher?.trim()
      ? { label: "Publisher", value: book.publisher, icon: Building2 }
      : null,
    book.page_count
      ? {
          label: "Page count",
          value: book.page_count.toLocaleString(),
          icon: BookOpen,
        }
      : null,
    book.isbn?.trim() ? { label: "ISBN", value: book.isbn, icon: Barcode } : null,
    book.language?.trim()
      ? { label: "Language", value: book.language, icon: Languages }
      : null,
  ] as Array<HeroFact | null>).filter(
    (fact): fact is HeroFact => fact !== null,
  );

  const libraryFacts = ([
    categoryPath ? { label: "Category", value: categoryPath, icon: Folder } : null,
    locationPath ? { label: "Location", value: locationPath, icon: MapPin } : null,
    book.date_added
      ? {
          label: "Added",
          value: formatDate(book.date_added, preferences),
          icon: CalendarDays,
        }
      : null,
    book.read && book.read_at
      ? {
          label: "Read on",
          value: formatDate(book.read_at, preferences),
          icon: Check,
        }
      : null,
    book.last_metadata_refresh_at
      ? {
          label: "Metadata refreshed",
          value: formatDateTime(book.last_metadata_refresh_at, preferences),
          icon: Clock3,
        }
      : null,
  ] as Array<LibraryFact | null>).filter(
    (fact): fact is LibraryFact => fact !== null,
  );

  function handleForegroundError() {
    if (resolvedCoverUrl && foregroundUrl === resolvedCoverUrl) {
      setFailedForegroundUrl(resolvedCoverUrl);
    }
  }

  const hasSynopsis = Boolean(book.description?.trim());

  return (
    <div className="min-w-0 bg-[#07111f]">
      <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#081421]">
        {showBackdrop && (
          <img
            key={`backdrop-banner-${resolvedCoverUrl}`}
            src={resolvedCoverUrl!}
            alt=""
            aria-hidden="true"
            onError={() => setFailedBackdropUrl(resolvedCoverUrl)}
            className="pointer-events-none absolute -inset-2 z-0 h-[calc(100%+1rem)] w-[calc(100%+1rem)] object-cover object-[center_34%] opacity-80 blur-[4px] md:object-[center_40%]"
          />
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-[#06111e]/75 via-[#071421]/82 to-[#071421]/92"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-[#06101c]/70 via-black/5 to-black/20"
        />

        <div className="relative z-20 mx-auto flex max-w-[980px] flex-col gap-7 px-5 pb-8 pt-7 sm:px-8 md:flex-row md:items-start md:gap-8 md:px-10 md:pb-6 md:pt-6 lg:px-12">
          <div className="mx-auto w-44 shrink-0 sm:w-48 md:mx-0 md:w-44">
            <div className="aspect-[2/3] overflow-hidden rounded-xl border border-white/15 bg-gray-900 shadow-[0_18px_45px_rgba(0,0,0,0.5)]">
              <img
                key={foregroundUrl}
                src={foregroundUrl}
                alt={`Cover of ${book.title}`}
                onError={handleForegroundError}
                className="h-full w-full object-cover"
              />
            </div>

            <div
              className={`mt-3 flex min-h-10 items-center rounded-xl border px-4 text-sm font-medium backdrop-blur-md ${
                book.read
                  ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                  : "border-white/20 bg-[#07111f]/55 text-gray-100"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mr-2 h-2 w-2 rounded-full ${
                  book.read ? "bg-emerald-400" : "bg-blue-500"
                }`}
              />
              {book.read ? "Read" : "Unread"}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col self-stretch text-center md:min-h-[260px] md:text-left">
            <div className="min-w-0">
              <h2 className="break-words text-3xl font-bold leading-[1.1] tracking-tight text-white sm:text-4xl lg:text-[42px]">
                {book.title}
              </h2>

              {book.subtitle?.trim() && (
                <p className="mt-2 break-words text-base leading-relaxed text-blue-200 sm:text-lg">
                  {book.subtitle}
                </p>
              )}

              <p className="mt-3 flex items-center justify-center gap-2 break-words text-base font-medium text-gray-100 md:justify-start">
                <UserRound size={17} className="shrink-0 text-gray-300" aria-hidden="true" />
                {book.author}
              </p>
            </div>

            {heroFacts.length > 0 && (
              <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 text-left sm:grid-cols-3 md:flex md:flex-wrap md:items-start">
                {heroFacts.map((fact) => (
                  <HeroMetadata key={fact.label} fact={fact} />
                ))}
              </div>
            )}

            <div className="mt-6 flex justify-center md:mt-auto md:justify-start md:pt-4">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50"
              >
                <Pencil size={16} aria-hidden="true" />
                Edit Book
              </button>
            </div>
          </div>
        </div>
      </section>

      {(hasSynopsis || libraryFacts.length > 0) && (
        <div
          className={`grid gap-4 p-4 sm:p-5 lg:p-6 ${
            hasSynopsis && libraryFacts.length > 0
              ? "lg:grid-cols-[1.15fr_1fr]"
              : "grid-cols-1"
          }`}
        >
          {hasSynopsis && (
            <section className="rounded-xl border border-white/10 bg-[#0a1726]/80 p-5 sm:p-6">
              <SectionTitle icon={BookOpen}>Synopsis</SectionTitle>
              <p className="mt-4 whitespace-pre-line break-words text-sm leading-7 text-gray-300 sm:text-[15px] sm:leading-7">
                {book.description}
              </p>
            </section>
          )}

          {libraryFacts.length > 0 && (
            <section className="rounded-xl border border-white/10 bg-[#0a1726]/80 p-5 sm:p-6">
              <SectionTitle icon={Folder}>Library Details</SectionTitle>
              <div className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {libraryFacts.map((fact) => (
                  <LibraryDetail key={fact.label} fact={fact} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
