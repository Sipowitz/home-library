import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

import { getBook, getCoverCandidates, refreshMetadata, selectCoverCandidate } from "../../../api/books";
import type { CoverCandidate, CoverRefreshResponse, ReviewIntent } from "../../../api/books";
import type { Book } from "../../../types/book";
import type { ReviewTarget } from "./MaintenanceSettings";
import { MetadataComparisonPanel } from "../../books/MetadataComparisonPanel";
import { CoverBrowserModal } from "../../books/CoverBrowserModal";

type Props = {
  book: Book;
  initialTarget: ReviewTarget;
  origin: "maintenance_direct" | "maintenance_guided" | "add_review";
  followUp: ReviewTarget | null;
  onSave: (book: Book, reviewIntent: ReviewIntent) => Promise<Book>;
  onSaved: (book: Book, origin: Props["origin"]) => void;
  onCancel: () => void;
  onEvidenceRefreshed: () => void;
};

export function MaintenanceReviewSession({
  book,
  initialTarget,
  origin,
  followUp,
  onSave,
  onSaved,
  onCancel,
  onEvidenceRefreshed,
}: Props) {
  const [draft, setDraft] = useState(book);
  const [target, setTarget] = useState<ReviewTarget>(initialTarget);
  const [coverCandidates, setCoverCandidates] = useState<CoverCandidate[]>([]);
  const [metadataPending, setMetadataPending] = useState(false);
  const [coverPending, setCoverPending] = useState(false);
  const [saveRequested, setSaveRequested] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshInFlight = useRef(false);
  const guided = origin !== "maintenance_direct";

  useEffect(() => {
    let mounted = true;
    getCoverCandidates(book.id)
      .then((response) => {
        if (mounted) setCoverCandidates(response.candidates);
      })
      .catch(() => {
        if (mounted) setCoverCandidates([]);
      });
    return () => {
      mounted = false;
    };
  }, [book.id]);

  const allCoverCandidates = useMemo(() => {
    const seen = new Set<string>();
    const merged: CoverCandidate[] = [];
    const add = (candidate: CoverCandidate) => {
      const url = candidate.url?.trim();
      if (!url || seen.has(url)) return;
      seen.add(url);
      merged.push({ ...candidate, url });
    };
    coverCandidates.forEach(add);
    (draft.uploaded_cover_candidates_json || []).forEach(add);
    if (draft.cover_url?.trim()) {
      add({ provider: "current", label: "Current cover", url: draft.cover_url.trim() });
    }
    return merged;
  }, [coverCandidates, draft.cover_url, draft.uploaded_cover_candidates_json]);

  useEffect(() => {
    if (!saveRequested || saving) return;
    setSaveRequested(false);
    setSaving(true);
    onSave(draft, {
      mark_metadata_reviewed: metadataPending,
      mark_cover_reviewed: coverPending,
    })
      .then((updated) => onSaved(updated, origin))
      .catch(() => {
        toast.error("Failed to save book");
      })
      .finally(() => setSaving(false));
  }, [coverPending, draft, guided, metadataPending, onSave, onSaved, origin, saveRequested, saving]);

  async function handleRefreshMetadata() {
    if (refreshInFlight.current) return;
    if (!draft.isbn?.trim()) {
      toast.error("Add an ISBN before refreshing metadata");
      return;
    }
    refreshInFlight.current = true;
    setIsRefreshing(true);
    setMetadataPending(false);
    try {
      const results = await refreshMetadata(draft.id);
      // The POST has committed evidence even if the subsequent book GET fails.
      onEvidenceRefreshed();
      const successful = results.filter((result) => result.success).length;
      const failed = results.length - successful;
      const failedProviders = results.filter((result) => !result.success)
        .map((result) => result.provider.replaceAll("_", " ")).join(", ");
      if (!results.length) {
        toast("No provider results returned; previous data was retained");
      } else if (!successful) {
        toast.error("Metadata refresh failed for all providers; previous data was retained");
      } else if (!failed) {
        toast.success(`Metadata refreshed from ${successful} provider${successful === 1 ? "" : "s"}`);
      } else {
        toast(`Refreshed from ${successful} provider${successful === 1 ? "" : "s"} • ${failed} failed (${failedProviders}); previous data retained`);
      }
      try {
        const updated = await getBook(draft.id);
        setDraft((current) => ({
          ...current,
          last_metadata_refresh_at: updated.last_metadata_refresh_at,
          metadata_review: updated.metadata_review,
        }));
      } catch (err) {
        console.error(err);
        toast.error("Refresh finished, but the book's review status could not be reloaded");
      }
      return results;
    } catch (err) {
      console.error(err);
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message : undefined;
      toast.error(message || "Metadata refresh failed");
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }

  function handleMetadataDone(selections: Record<string, unknown>) {
    setDraft((current) => ({ ...current, ...selections }));
    setMetadataPending(true);
    if (guided && followUp === "covers") {
      setTarget("covers");
    } else {
      setSaveRequested(true);
    }
  }

  function handleCoverRefresh(response: CoverRefreshResponse) {
    setCoverCandidates(response.candidates);
    setDraft((current) => ({
      ...current,
      cover_review: response.cover_review,
      last_cover_refresh_at: response.cover_review.last_refresh_at,
    }));
  }

  function handleCoverDone() {
    setCoverPending(true);
    setSaveRequested(true);
  }

  return (
    <div className="fixed inset-0 z-[100]">
      {target === "metadata" && (
        <MetadataComparisonPanel
          bookId={draft.id}
          currentData={draft}
          coverUrl={draft.cover_url}
          onClose={onCancel}
          onRefreshMetadata={handleRefreshMetadata}
          isRefreshing={isRefreshing}
          onApplySelectedMetadata={handleMetadataDone}
        />
      )}
      {target === "covers" && (
        <CoverBrowserModal
          open
          title={draft.title || "Book Covers"}
          bookId={draft.id}
          covers={allCoverCandidates}
          selectedCoverUrl={draft.cover_url}
          onClose={onCancel}
          onRefreshStarted={() => setCoverPending(false)}
          onCoversRefreshed={handleCoverRefresh}
          onCoverUploaded={(cover) => setDraft((current) => ({
            ...current,
            uploaded_cover_candidates_json: [
              cover,
              ...(current.uploaded_cover_candidates_json || []),
            ],
          }))}
          onSelectCover={async (cover) => {
            if (cover.url.startsWith("/covers/candidate-cache/")) {
              setDraft(await selectCoverCandidate(draft.id, cover));
              return;
            }
            setDraft((current) => ({ ...current, cover_url: cover.url }));
          }}
          onMarkReviewed={handleCoverDone}
        />
      )}
      {saving && <div className="sr-only" role="status">Saving review</div>}
    </div>
  );
}
