import React, { useEffect, useMemo, useState } from "react";

import {
  BookOpen,
  BookText,
  CalendarDays,
  Image,
  Library,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

import type { Book } from "../../types/book";
import type { Category } from "../../types/category";
import type { Location } from "../../types/location";
import type { ProviderResult } from "../../types/provider";

import { CategoryTreeSelector } from "./CategoryTreeSelector";
import { LocationTreeSelector } from "./LocationTreeSelector";
import { FieldLabel } from "./FieldLabel";

import { MetadataComparisonPanel } from "./MetadataComparisonPanel";

import { CoverBrowserModal } from "./CoverBrowserModal";

import { fetchMetadataCandidates } from "../../api/metadataCandidates";

import { getBook, refreshMetadata } from "../../api/books";

import toast from "react-hot-toast";

import { usePreferencesContext } from "../../context/PreferencesContext";

import { formatDateTime } from "../../utils/dateFormatters";

type Props = {
  editData: Book | null;

  setEditData: (book: Book) => void;

  categories: Category[];

  locations: Location[];

  textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  onSave: () => void;


  onDelete: () => void;

  onComparisonClose?: () => void;

  onComparisonOpenChange?: (open: boolean) => void;

  onBookUpdated: (book: Book) => void;
};

type CoverCandidate = {
  provider: string;

  label: string;

  url: string;
};

export function BookEdit({
  editData,
  setEditData,
  categories,
  locations,
  textareaRef,
  onSave,
  onDelete,
  onComparisonClose,
  onComparisonOpenChange,
  onBookUpdated,
}: Props) {
  const [providers, setProviders] = useState<ProviderResult[]>([]);

  const [coverModalOpen, setCoverModalOpen] = useState(false);

  const [showMetadataPanel, setShowMetadataPanel] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    onComparisonOpenChange?.(showMetadataPanel);
  }, [onComparisonOpenChange, showMetadataPanel]);

  const selectedCategoryId = editData?.category_id ?? null;

  const { preferences } = usePreferencesContext();

  // -------------------
  // 📥 PROVIDERS
  // -------------------

  useEffect(() => {
    async function load() {
      if (!editData?.id) return;

      try {
        const results = await fetchMetadataCandidates(editData.id);

        setProviders(results);
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, [editData?.id]);

  // -------------------
  // 🖼️ COVERS
  // -------------------

  const allCoverCandidates = useMemo(() => {
    const seen = new Set();

    const merged: CoverCandidate[] = [];

    for (const provider of providers) {
      const data = provider.data || {};

      const covers = data.cover_candidates || [];

      for (const cover of covers) {
        if (!cover.url || seen.has(cover.url)) {
          continue;
        }

        seen.add(cover.url);

        merged.push(cover);
      }
    }

    for (const cover of editData?.uploaded_cover_candidates_json || []) {
      if (!cover.url || seen.has(cover.url)) {
        continue;
      }

      seen.add(cover.url);

      merged.push(cover);
    }

    return merged;
  }, [providers, editData?.uploaded_cover_candidates_json]);

  // -------------------
  // 🏷️ CATEGORY
  // -------------------

  function handleCategorySelect(id: number | null) {
    const newId = id === -1 ? null : id;

    setEditData({
      ...editData!,
      category_id: newId,
    });
  }

  // -------------------
  // 🖼️ FALLBACK
  // -------------------

  function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;

    if (!img.src.includes("fallback-cover.png")) {
      img.src = "/fallback-cover.png";
    }
  }

  // -------------------
  // 🔄 REFRESH METADATA
  // -------------------

  async function handleRefreshMetadata() {
    if (!editData?.id || isRefreshing) {
      return;
    }

    try {
      setIsRefreshing(true);

      const results = await refreshMetadata(editData.id);

      setProviders(results);

      const updatedBook = await getBook(editData.id);

      setEditData(updatedBook);

      onBookUpdated(updatedBook);

      const successful = results.filter((r) => r.success).length;

      const failed = results.length - successful;

      if (failed === 0) {
        toast.success(
          `Metadata refreshed from ${successful} provider${successful === 1 ? "" : "s"}`,
        );
      } else {
        toast(
          `Refreshed from ${successful} provider${successful === 1 ? "" : "s"} • ${failed} failed`,
        );
      }

      setShowMetadataPanel(true);

      return results;
    } catch (err) {
      console.error(err);

      toast.error("Metadata refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-white/10 bg-[#091624] px-3 text-sm text-white outline-none transition focus:border-blue-500/50 focus:bg-[#0b1a2b] focus:ring-2 focus:ring-blue-500/10";

  const sectionClass =
    "rounded-xl border border-white/[0.08] bg-[#0a1625]/80 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.12)]";

  function SectionHeading({
    icon,
    children,
  }: {
    icon: React.ReactNode;
    children: React.ReactNode;
  }) {
    return (
      <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-2.5">
        <span className="text-blue-400">{icon}</span>
        <h3 className="text-[13px] font-semibold tracking-wide text-slate-100">
          {children}
        </h3>
      </div>
    );
  }

  return (
    <>
      <div className="relative mx-auto w-full max-w-[1120px]">
        <div className="grid gap-5">
          <div className="grid items-start gap-5 md:grid-cols-[180px_minmax(0,1fr)_150px] lg:grid-cols-[190px_minmax(0,1fr)_155px]">
          <aside className="mx-auto w-full max-w-[190px] md:mx-0">
            <button
              type="button"
              onClick={() => setCoverModalOpen(true)}
              aria-label={`Change cover for ${editData?.title || "book"}`}
              className="group relative block aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/10 bg-[#091624] shadow-[0_18px_40px_rgba(0,0,0,0.35)] transition hover:border-blue-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
            >
              <img
                src={
                  editData?.cover_url ||
                  "https://dummyimage.com/300x400/1f2937/ffffff&text=No+Cover"
                }
                onError={handleImgError}
                alt={"Cover of " + (editData?.title || "book")}
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
              />
              <span className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-black/65 px-3 py-2 text-xs font-medium text-white opacity-100 backdrop-blur-sm transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100">
                <Image size={14} aria-hidden="true" />
                Change Cover
              </span>
            </button>
          </aside>

            <section className={sectionClass}>
              <SectionHeading icon={<BookText size={16} />}>
                Core Details
              </SectionHeading>
              <div className="space-y-3">
                <div>
                  <FieldLabel>Title</FieldLabel>
                  <input value={editData?.title || ""} onChange={(e) => setEditData({ ...editData!, title: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Subtitle</FieldLabel>
                  <input value={editData?.subtitle || ""} onChange={(e) => setEditData({ ...editData!, subtitle: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Author</FieldLabel>
                  <input value={editData?.author || ""} onChange={(e) => setEditData({ ...editData!, author: e.target.value })} className={inputClass} />
                </div>
              </div>
            </section>

            <div className="flex min-w-0 flex-col gap-2">
              <button type="button" onClick={() => setShowMetadataPanel(true)} className="flex h-10 w-full items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-medium text-slate-200 transition hover:border-blue-500/25 hover:text-blue-300">Compare Metadata</button>
              <button type="button" onClick={onSave} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.22)] transition hover:bg-blue-500"><Save size={15} /> Save Changes</button>
              <button type="button" onClick={onDelete} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3 text-xs font-medium text-red-300 transition hover:bg-red-500/15"><Trash2 size={15} /> Delete Book</button>
            </div>
          </div>

          <div className="w-full">
              <section className={sectionClass}>
                <SectionHeading icon={<Library size={16} />}>
                  Library
                </SectionHeading>
                <div className="grid gap-3 md:grid-cols-3">
                  <CategoryTreeSelector
                    categories={categories}
                    selectedCategoryId={selectedCategoryId}
                    onSelect={handleCategorySelect}
                    showSpecialOptions={false}
                  />
                  <LocationTreeSelector
                    locations={locations}
                    selectedLocationId={editData?.location_id ?? null}
                    onSelect={(id) => setEditData({ ...editData!, location_id: id })}
                  />
                  <div>
                    <FieldLabel>Reading Status</FieldLabel>
                    <button
                      type="button"
                      onClick={() => setEditData({ ...editData!, read: !editData?.read })}
                      className={
                        "flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition " +
                        (editData?.read
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                          : "border-white/10 bg-[#091624] text-slate-300")
                      }
                    >
                      <span>{editData?.read ? "Read" : "Unread"}</span>
                      <span className={"h-2 w-2 rounded-full " + (editData?.read ? "bg-emerald-400" : "bg-slate-500")} />
                    </button>
                  </div>
                </div>
              </section>

          </div>

          <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(250px,0.9fr)]">
            <section className={sectionClass + " flex min-h-0 flex-col"}>
              <SectionHeading icon={<BookOpen size={16} />}>
                Synopsis
              </SectionHeading>
              <FieldLabel>Description</FieldLabel>
              <textarea
                ref={textareaRef}
                rows={8}
                value={editData?.description || ""}
                onChange={(e) => setEditData({ ...editData!, description: e.target.value })}
                className="min-h-0 flex-1 w-full resize-none overflow-y-auto rounded-lg border border-white/10 bg-[#091624] p-3 text-sm leading-relaxed text-white outline-none transition focus:border-blue-500/50 focus:bg-[#0b1a2b] focus:ring-2 focus:ring-blue-500/10"
              />
            </section>

                                      <div className="grid gap-4">

            <section className={sectionClass}>
              <SectionHeading icon={<CalendarDays size={16} />}>
                Publication
              </SectionHeading>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FieldLabel>Publisher</FieldLabel>
                  <input value={editData?.publisher || ""} onChange={(e) => setEditData({ ...editData!, publisher: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Year</FieldLabel>
                  <input value={editData?.year || ""} onChange={(e) => setEditData({ ...editData!, year: Number(e.target.value) })} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Language</FieldLabel>
                  <input value={editData?.language || ""} onChange={(e) => setEditData({ ...editData!, language: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>Page Count</FieldLabel>
                  <input value={editData?.page_count || ""} onChange={(e) => setEditData({ ...editData!, page_count: Number(e.target.value) })} className={inputClass} />
                </div>
                <div>
                  <FieldLabel>ISBN</FieldLabel>
                  <input value={editData?.isbn || ""} onChange={(e) => setEditData({ ...editData!, isbn: e.target.value })} className={inputClass} />
                </div>
              </div>
            </section>

<section className={sectionClass}>
                <SectionHeading icon={<RefreshCw size={16} />}>
                  Metadata
                </SectionHeading>
                <dl className="space-y-2.5 text-xs">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Date added</dt>
                    <dd className="text-right text-slate-200">
                      {editData?.date_added ? formatDateTime(editData.date_added, preferences) : "—"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-slate-500">Last refresh</dt>
                    <dd className="text-right text-slate-200">
                      {editData?.last_metadata_refresh_at
                        ? formatDateTime(editData.last_metadata_refresh_at, preferences)
                        : "Never"}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </div>
        </div>

      </div>

      {/* ===================================== */}
      {/* METADATA PANEL */}
      {/* ===================================== */}

      {showMetadataPanel && editData?.id && (
        <MetadataComparisonPanel
          bookId={editData.id}
          currentData={editData || {}}
          onClose={onComparisonClose ?? (() => setShowMetadataPanel(false))}
          onRefreshMetadata={handleRefreshMetadata}
          isRefreshing={isRefreshing}
          coverUrl={editData?.cover_url}
          onApplySelectedMetadata={(selections) => {
            setEditData({
              ...editData!,
              ...selections,
            });
            setShowMetadataPanel(false);
          }}
        />
      )}

      {/* ===================================== */}
      {/* COVER MODAL */}
      {/* ===================================== */}

      <CoverBrowserModal
        open={coverModalOpen}
        onClose={() => setCoverModalOpen(false)}
        title={editData?.title || "Book Covers"}
        covers={allCoverCandidates}
        bookId={editData?.id}
        selectedCoverUrl={editData?.cover_url}
        onCoverUploaded={(cover) => {
          setEditData({
            ...editData!,
            uploaded_cover_candidates_json: [
              cover,
              ...(editData?.uploaded_cover_candidates_json || []),
            ],
          });
        }}
        onSelectCover={(cover) => {
          console.log("SELECTED COVER URL", cover.url);

          setEditData({
            ...editData!,
            cover_url: cover.url,
          });

          setCoverModalOpen(false);
        }}
      />
    </>
  );
}
