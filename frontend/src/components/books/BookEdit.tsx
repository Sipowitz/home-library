import React, { useEffect, useMemo, useState } from "react";

import {
  BookOpen,
  BookText,
  CalendarDays,
  Image,
  Library,
  Save,
  Trash2,
} from "lucide-react";

import type { Book, ReviewStatus } from "../../types/book";
import type { Category } from "../../types/category";
import type { Location } from "../../types/location";
import type { ProviderResult } from "../../types/provider";

import { CategoryTreeSelector } from "./CategoryTreeSelector";
import { LocationTreeSelector } from "./LocationTreeSelector";
import { FieldLabel } from "./FieldLabel";

import { MetadataComparisonPanel } from "./MetadataComparisonPanel";

import { CoverBrowserModal } from "./CoverBrowserModal";
import { ActionButton } from "../ui/ActionButton";

import { fetchMetadataCandidates } from "../../api/metadataCandidates";

import { getBook, getCoverCandidates, refreshMetadata } from "../../api/books";
import type { CoverCandidate, CoverRefreshResponse, ReviewIntent } from "../../api/books";

import toast from "react-hot-toast";
import { usePreferencesContext } from "../../context/PreferencesContext";
import { formatDate } from "../../utils/dateFormatters";

type Props = {
  editData: Book | null;

  setEditData: (book: Book) => void;

  categories: Category[];

  locations: Location[];

  textareaRef: React.RefObject<HTMLTextAreaElement | null>;

  onSave: (reviewIntent?: ReviewIntent) => void;


  onDelete: () => void;

  onComparisonClose?: () => void;

  onComparisonOpenChange?: (open: boolean) => void;

};

function reviewLabel(status: ReviewStatus | undefined, pending: boolean) {
  if (pending) return "Review pending save";
  if (status?.state === "current") return "Reviewed";
  if (status?.state === "changed") return "Changed since review";
  return "Never reviewed";
}

function reviewTone(status: ReviewStatus | undefined, pending: boolean) {
  if (pending) return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (status?.state === "current") return "border-success/25 bg-success-muted/60 text-success";
  if (status?.state === "changed") return "border-warning/25 bg-warning-muted/60 text-warning";
  return "border-border-strong bg-control/70 text-text-muted";
}

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
}: Props) {
  const [providers, setProviders] = useState<ProviderResult[]>([]);

  const [coverModalOpen, setCoverModalOpen] = useState(false);

  const [showMetadataPanel, setShowMetadataPanel] = useState(false);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const [providerCoverCandidates, setProviderCoverCandidates] = useState<CoverCandidate[]>([]);
  const [metadataReviewPending, setMetadataReviewPending] = useState(false);
  const [coverReviewPending, setCoverReviewPending] = useState(false);

  useEffect(() => {
    setMetadataReviewPending(false);
    setCoverReviewPending(false);
    setShowMetadataPanel(false);
    setCoverModalOpen(false);
  }, [editData?.id]);


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

  useEffect(() => {
    let mounted = true;
    if (!editData?.id) return;
    getCoverCandidates(editData.id)
      .then((response) => {
        if (!mounted) return;
        setProviderCoverCandidates(response.candidates);
      })
      .catch((error) => console.error(error));
    return () => { mounted = false; };
  }, [editData?.id]);


  // -------------------

  const allCoverCandidates = useMemo(() => {
    const seen = new Set();

    const merged: CoverCandidate[] = [];

    for (const cover of providerCoverCandidates) {
        if (!cover.url || seen.has(cover.url)) {
          continue;
        }

        seen.add(cover.url);

        merged.push(cover);
    }

    for (const cover of editData?.uploaded_cover_candidates_json || []) {
      if (!cover.url || seen.has(cover.url)) {
        continue;
      }

      seen.add(cover.url);

      merged.push(cover);
    }

    const activeCoverUrl = editData?.cover_url?.trim();

    if (activeCoverUrl && !seen.has(activeCoverUrl)) {
      merged.push({
        provider: "current",
        label: "Current cover",
        url: activeCoverUrl,
      });
    }

    return merged;
  }, [
    providerCoverCandidates,
    editData?.uploaded_cover_candidates_json,
    editData?.cover_url,
  ]);

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

    if (!editData.isbn) {
      toast.error("Add an ISBN before refreshing metadata");
      return;
    }
    setMetadataReviewPending(false);

    try {
      setIsRefreshing(true);

      const results = await refreshMetadata(editData.id);

      const mergedResults = mergeProviderResults(providers, results);

      setProviders(mergedResults);

      const updatedBook = await getBook(editData.id);

      setEditData({
        ...editData,
        last_metadata_refresh_at: updatedBook.last_metadata_refresh_at,
        metadata_review: updatedBook.metadata_review,
      });

      const successful = results.filter((r) => r.success).length;

      const failed = results.length - successful;
      const failedProviders = results.filter((result) => !result.success).map((result) => result.provider.replaceAll("_", " ")).join(", ");

      if (successful === 0) {
        toast.error("Metadata refresh failed for all providers; previous data was retained");
      } else if (failed === 0) {
        toast.success(
          `Metadata refreshed from ${successful} provider${successful === 1 ? "" : "s"}`,
        );
      } else {
        toast(
          `Refreshed from ${successful} provider${successful === 1 ? "" : "s"} • ${failed} failed (${failedProviders}); previous data retained`,
        );
      }

      setShowMetadataPanel(true);

      return mergedResults;
    } catch (err) {
      console.error(err);

      toast.error("Metadata refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  }

  const inputClass =
    "form-control h-9 w-full rounded-lg px-3 text-sm transition dark:bg-[#091624] dark:focus:bg-[#0b1a2b]";

  const sectionClass =
    "rounded-xl border border-border bg-surface/95 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.12)] dark:bg-[#0a1625]/80";

  function SectionHeading({
    icon,
    children,
  }: {
    icon: React.ReactNode;
    children: React.ReactNode;
  }) {
    return (
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2.5">
        <span className="text-blue-600 dark:text-blue-400">{icon}</span>
        <h3 className="text-[13px] font-semibold tracking-wide text-text-primary">
          {children}
        </h3>
      </div>
    );
  }

  return (
    <>
      <div className="relative mx-auto w-full">
        <div className="grid items-start gap-5 px-5 pb-3 pt-7 sm:px-8 md:grid-cols-[176px_minmax(0,1fr)_minmax(0,1fr)] md:px-10 md:pb-2 md:pt-6 lg:px-12">
          <aside className="mx-auto w-44 md:mx-0">
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

            <section className={sectionClass + " md:h-[264px]"}>
              <SectionHeading icon={<BookText size={16} />}>
                Core Details
              </SectionHeading>
              <div className="space-y-2">
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

            <section className={sectionClass + " md:mr-4 md:h-[264px]"}>
              <SectionHeading icon={<CalendarDays size={16} />}>
                Publication
              </SectionHeading>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
          </div>

          <div className="grid gap-4 px-4 pb-4 pt-2 sm:px-5 sm:pb-5 lg:px-6 lg:pb-6">
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
                    floating
                    semanticTheme
                  />
                  <LocationTreeSelector
                    locations={locations}
                    selectedLocationId={editData?.location_id ?? null}
                    onSelect={(id) => setEditData({ ...editData!, location_id: id })}
                    floating
                    semanticTheme
                  />
                  <div>
                    <FieldLabel>Reading Status</FieldLabel>
                    <button
                      type="button"
                      onClick={() => setEditData({ ...editData!, read: !editData?.read })}
                      className={
                        "flex h-10 w-full items-center justify-between rounded-lg border px-3 text-sm transition " +
                        (editData?.read
                          ? "border-success/25 bg-success-muted/60 text-success"
                          : "border-border-strong bg-control text-text-secondary dark:bg-[#091624]")
                      }
                    >
                      <span>{editData?.read ? "Read" : "Unread"}</span>
                      <span className={"h-2 w-2 rounded-full " + (editData?.read ? "bg-emerald-400" : "bg-slate-500")} />
                    </button>
                  </div>
                </div>
              </section>

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
              className="form-control min-h-0 w-full resize-y overflow-y-auto rounded-lg p-3 text-sm leading-relaxed transition dark:bg-[#091624] dark:focus:bg-[#0b1a2b]"
            />
          </section>

          <section className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-border bg-surface/95 px-4 py-3 text-xs shadow-[0_12px_30px_rgba(0,0,0,0.1)] dark:bg-[#0a1625]/65">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium text-text-secondary">Metadata</span>
              <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${reviewTone(editData?.metadata_review, metadataReviewPending)}`}>{reviewLabel(editData?.metadata_review, metadataReviewPending)}</span>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-medium text-text-secondary">Covers</span>
              <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] ${reviewTone(editData?.cover_review, coverReviewPending)}`}>{reviewLabel(editData?.cover_review, coverReviewPending)}</span>
            </div>
            <div className="text-[11px] text-text-muted">
              {editData?.last_metadata_refresh_at
                ? `Refreshed ${formatDate(editData.last_metadata_refresh_at, preferences)}`
                : "Never refreshed"}
            </div>
            <ActionButton variant="secondary" size="sm" onClick={() => setShowMetadataPanel(true)} className="sm:ml-auto">Compare Metadata</ActionButton>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <ActionButton variant="danger" onClick={onDelete}><Trash2 size={15} /> Delete Book</ActionButton>
            <ActionButton variant="primary" onClick={() => onSave({ mark_metadata_reviewed: metadataReviewPending, mark_cover_reviewed: coverReviewPending })}><Save size={15} /> Save Changes</ActionButton>
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
          onClose={() => { setShowMetadataPanel(false); onComparisonClose?.(); }}
          onRefreshMetadata={handleRefreshMetadata}
          isRefreshing={isRefreshing}
          coverUrl={editData?.cover_url}
          onApplySelectedMetadata={(selections) => {
            setEditData({
              ...editData!,
              ...selections,
            });
            setMetadataReviewPending(true);
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
        onRefreshStarted={() => setCoverReviewPending(false)}
        onCoversRefreshed={(response: CoverRefreshResponse) => {
          setProviderCoverCandidates(response.candidates);
          setEditData({ ...editData!, cover_review: response.cover_review, last_cover_refresh_at: response.cover_review.last_refresh_at });
        }}
        onMarkReviewed={() => {
          setCoverReviewPending(true);
          setCoverModalOpen(false);
        }}
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
          setEditData({
            ...editData!,
            cover_url: cover.url,
          });

        }}
      />
    </>
  );
}
