import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import type { ReviewQueueBook } from "../../../api/maintenance";
import { getReviewQueue, startMaintenanceRefresh, getActiveMaintenanceJob, getMaintenanceJob, cancelMaintenanceJob, type MaintenanceJob } from "../../../api/maintenance";
import { useMaintenance } from "../../../hooks/useMaintenance";
import { resolveCoverUrl } from "../../books/BookView";
import { ActionButton } from "../../ui/ActionButton";
import { statusActionBaseClasses } from "../../ui/actionButtonStyles";

export type ReviewTarget = "book" | "metadata" | "covers";

type Props = {
  active: boolean;
  reviewSaved?: { bookId: number; nonce: number; guided?: boolean } | null;
  onReview: (bookId: number, target: ReviewTarget, guided?: boolean, followUp?: ReviewTarget | null) => void;
  onReviewSequenceComplete: () => void;
};

function label(state: string) {
  if (state === "current") return "Reviewed";
  if (state === "changed") return "Changed since review";
  return "Never reviewed";
}

function tone(state: string) {
  if (state === "current") return "border-success/25 bg-success-muted/60 text-success";
  if (state === "changed") return "border-warning/25 bg-warning-muted/60 text-warning";
  return "border-border-strong bg-control/70 text-text-secondary";
}

function StatusButton({ book, target }: { book: ReviewQueueBook; target: "metadata" | "covers" }) {
  const status = target === "metadata" ? book.metadata_review : book.cover_review;
  return (
    <span className={`${statusActionBaseClasses} ${tone(status.state)}`}>
      {label(status.state)}
    </span>
  );
}

function jobTone(status: string) {
  if (status === "completed") return "border-success/25";
  if (status === "failed") return "border-danger/30";
  if (status === "cancelled") return "border-warning/25";
  return "border-blue-500/25";
}

function jobLabel(job: MaintenanceJob) {
  if (job.status === "completed") return "Refresh complete";
  if (job.status === "failed") return "Refresh failed";
  if (job.status === "cancelled") return "Refresh cancelled";
  if (job.status === "pending") return "Refresh queued";
  return `Refreshing ${job.kind === "metadata_refresh" ? "metadata" : "covers"}`;
}

export function MaintenanceSettings({ active, reviewSaved, onReview, onReviewSequenceComplete }: Props) {
  const queue = useMaintenance(active);
  const [job, setJob] = useState<MaintenanceJob | null>(null);
  const [confirmKind, setConfirmKind] = useState<"metadata" | "covers" | null>(null);
  const handledSaveRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    getActiveMaintenanceJob().then(setJob).catch(() => undefined);
  }, [active]);
  useEffect(() => {
    if (!active || !job || !["pending", "running"].includes(job.status)) return;
    const timer = window.setInterval(() => getMaintenanceJob(job.id).then(setJob).catch(() => undefined), 1500);
    return () => window.clearInterval(timer);
  }, [active, job]);
  async function startRefresh() {
    if (!confirmKind) return;
    try {
      setJob(await startMaintenanceRefresh(confirmKind));
    } catch (err: unknown) {
      const message = axios.isAxiosError<{ message?: string }>(err)
        ? err.response?.data?.message
        : undefined;
      toast.error(message || "A refresh is already running");
    }
    setConfirmKind(null);
  }

  async function openFirstEligible(excludeBookId?: number) {
    const result = await getReviewQueue({
      skip: 0,
      limit: excludeBookId == null ? 1 : 2,
      aspect: queue.aspect,
      reason: queue.reason,
      search: queue.search.trim() || undefined,
    });
    const next = result.items.find((item) => item.id !== excludeBookId);
    if (next) {
      const target = firstTarget(next, queue.aspect, queue.reason);
      onReview(next.id, target, true, followUpTarget(next, target, queue.aspect, queue.reason));
    }
    else onReviewSequenceComplete();
  }

  useEffect(() => {
    if (!active || !reviewSaved || handledSaveRef.current === reviewSaved.nonce) return;
    handledSaveRef.current = reviewSaved.nonce;
    queue.refresh().then((result) => {
      if (!result) return;
      if (result.items.some((item) => item.id === reviewSaved.bookId)) {
        toast("This book still needs review and remains in the queue.");
      }
      if (!reviewSaved.guided) return;
      openFirstEligible(reviewSaved.bookId).catch((err) => {
        console.error("Failed to advance review queue", err);
        onReviewSequenceComplete();
      });
    });
    // openFirstEligible uses the same filter values as queue.refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, onReview, onReviewSequenceComplete, queue, reviewSaved]);

  const summary = queue.data?.summary;
  const items = queue.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil((queue.data?.total ?? 0) / queue.pageSize));

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Maintenance</h2>
          <div className="mt-1 text-sm font-medium text-text-secondary">{summary?.total ?? 0} books need review</div>
          <p className="mt-1 max-w-3xl text-sm text-text-muted">
            Review metadata and cover choices for books in your library.
          </p>
        </div>
        <ActionButton
          type="button"
          variant="primary"
          disabled={!items.length || queue.loading}
          onClick={() => openFirstEligible().catch((err) => console.error("Failed to open next review", err))}
          className="min-h-10 px-4 font-semibold"
        >
          Review Next
        </ActionButton>
      </div>

      <section aria-labelledby="review-queue-heading" className="rounded-xl border border-border bg-surface/60 p-3 sm:p-4">
        <div className="flex items-center gap-2"><h3 id="review-queue-heading" className="text-sm font-semibold text-text-primary">Review Queue</h3><details className="relative"><summary aria-label="Explain changed review status" className="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-full border border-border-strong text-xs text-text-muted hover:text-text-primary">i</summary><p className="absolute left-0 top-8 z-10 w-72 rounded-lg border border-border-strong bg-surface-raised p-3 text-xs leading-relaxed text-text-secondary shadow-xl dark:bg-canvas">Changed since review means provider metadata or available provider cover choices changed since you last reviewed this book. Your saved book and selected cover were not changed automatically.</p></details></div>
        {summary && (
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-y border-border py-2 text-xs text-text-secondary" aria-label="Review queue summary">
            <span><strong className="text-text-primary">{summary.metadata_never_reviewed}</strong> Metadata to review</span>
            <span><strong className="text-warning">{summary.metadata_changed}</strong> Metadata changed</span>
            <span><strong className="text-text-primary">{summary.cover_never_reviewed}</strong> Covers to review</span>
            <span><strong className="text-warning">{summary.cover_changed}</strong> Covers changed</span>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex rounded-lg border border-border-strong bg-control p-1 dark:bg-canvas" aria-label="Review aspect filter">
            {(["all", "metadata", "covers"] as const).map((value) => (
              <button key={value} type="button" onClick={() => queue.setAspect(value)} className={`min-h-9 flex-1 rounded-md px-3 text-xs capitalize sm:flex-none ${queue.aspect === value ? "bg-surface-raised text-text-primary shadow-sm ring-1 ring-border-strong dark:bg-border-strong dark:text-white" : "text-text-muted hover:text-text-primary"}`}>{value}</button>
            ))}
          </div>
          <select aria-label="Review reason" value={queue.reason} onChange={(event) => queue.setReason(event.target.value as typeof queue.reason)} className="form-control min-h-11 rounded-lg px-3 text-sm dark:bg-canvas">
            <option value="all">All reasons</option><option value="never_reviewed">Never reviewed</option><option value="changed">Changed</option>
          </select>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search review queue by title, author, or ISBN</span>
            <Search aria-hidden="true" size={16} className="absolute left-3 top-3.5 text-text-muted" />
            <input value={queue.search} onChange={(event) => queue.setSearch(event.target.value)} placeholder="Search title, author, or ISBN" className="form-control min-h-11 w-full rounded-lg pl-9 pr-3 text-sm dark:bg-canvas" />
          </label>
        </div>

        <div className="mt-3 min-h-20" aria-live="polite">
          {queue.loading && !queue.data ? <p className="py-8 text-center text-sm text-text-muted">Loading review queue…</p> : queue.error ? <p role="alert" className="py-8 text-center text-sm text-danger">{queue.error}</p> : items.length === 0 ? (
            <div className="py-10 text-center"><h4 className="font-medium text-success">Everything is reviewed</h4><p className="mt-1 text-sm text-text-muted">All current metadata and cover choices in this view have been reviewed.</p></div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-border md:block">
                <table className="w-full text-left text-sm"><thead className="bg-surface-muted text-xs text-text-muted dark:bg-canvas/80"><tr><th className="px-3 py-2 font-medium">Book</th><th className="px-3 py-2 font-medium">Metadata</th><th className="px-3 py-2 font-medium">Covers</th></tr></thead>
                  <tbody className="divide-y divide-border">{items.map((book) => <tr key={book.id} className="bg-surface/70 hover:bg-surface-muted dark:bg-surface/30"><td className="px-3 py-2"><BookIdentity book={book} /></td><td className="px-3 py-2"><button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60" aria-label={`Review metadata for ${book.title}`} onClick={() => onReview(book.id, "metadata")}><StatusButton book={book} target="metadata" /></button></td><td className="px-3 py-2"><button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60" aria-label={`Review covers for ${book.title}`} onClick={() => onReview(book.id, "covers")}><StatusButton book={book} target="covers" /></button></td></tr>)}</tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">{items.map((book) => <article key={book.id} className="rounded-lg border border-border bg-surface p-3 dark:bg-canvas/50"><BookIdentity book={book} /><div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs"><span className="text-text-muted">Metadata</span><button type="button" className="justify-self-start rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60" onClick={() => onReview(book.id, "metadata")} aria-label={`Review metadata for ${book.title}`}><StatusButton book={book} target="metadata" /></button><span className="text-text-muted">Covers</span><button type="button" className="justify-self-start rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60" onClick={() => onReview(book.id, "covers")} aria-label={`Review covers for ${book.title}`}><StatusButton book={book} target="covers" /></button></div></article>)}</div>
            </>
          )}
        </div>

        {(queue.data?.total ?? 0) > queue.pageSize && <div className="mt-3 flex items-center justify-end gap-2 text-xs text-text-muted"><ActionButton variant="icon" size="iconSm" aria-label="Previous review queue page" disabled={queue.page === 0} onClick={() => queue.setPage((page) => page - 1)}><ChevronLeft size={16} /></ActionButton><span>Page {queue.page + 1} of {totalPages}</span><ActionButton variant="icon" size="iconSm" aria-label="Next review queue page" disabled={queue.page + 1 >= totalPages} onClick={() => queue.setPage((page) => page + 1)}><ChevronRight size={16} /></ActionButton></div>}
      </section>
      <section className="rounded-xl border border-border bg-surface/60 p-3 sm:p-4">
        <h3 className="text-sm font-semibold text-text-primary">Provider Refresh</h3>
        <p className="mt-1 text-xs text-text-muted">Check providers for updated evidence. Saved fields and selected covers are never changed automatically.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton variant="utility" disabled={Boolean(job && ["pending", "running"].includes(job.status))} onClick={() => setConfirmKind("metadata")} className="px-3">Refresh All Metadata</ActionButton>
          <ActionButton variant="utility" disabled={Boolean(job && ["pending", "running"].includes(job.status))} onClick={() => setConfirmKind("covers")} className="px-3">Refresh All Covers</ActionButton>
        </div>
        {job && <div className={`mt-4 rounded-lg border bg-surface-muted/70 p-3 text-xs dark:bg-canvas/60 ${jobTone(job.status)}`} aria-live="polite"><div className="flex justify-between text-text-secondary"><span>{jobLabel(job)}</span><span>{job.processed} / {job.total}</span></div><progress className="mt-2 h-2 w-full accent-blue-600" max={job.total || 1} value={job.processed} aria-label="Refresh progress" />{job.current_title && <div className="mt-2 truncate text-text-secondary">Current: {job.current_title}</div>}<div className="mt-2 text-text-muted"><span className={job.changed ? "text-success" : ""}>{job.changed} changed</span> · {job.unchanged} unchanged · <span className={job.partially_succeeded ? "text-warning" : ""}>{job.partially_succeeded} partial</span> · <span className={job.failed ? "text-danger" : ""}>{job.failed} failed</span> · {job.skipped} skipped</div>{job.error_summary && <div className="mt-2 text-danger">{job.error_summary}</div>}{["pending", "running"].includes(job.status) && <ActionButton variant="danger" size="sm" onClick={() => cancelMaintenanceJob(job.id).then(setJob)} className="mt-2">Cancel Refresh</ActionButton>}</div>}
      </section>
      {confirmKind && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-xl border border-border-strong bg-surface-raised p-5 text-text-primary shadow-2xl dark:bg-surface"><h2 className="text-lg font-semibold">Start provider refresh?</h2><p className="mt-2 text-sm text-text-secondary">This may take several minutes. Saved Book fields and selected covers will not change; updated evidence may add books to the Review Queue.</p><div className="mt-5 flex justify-end gap-2"><ActionButton variant="tertiary" onClick={() => setConfirmKind(null)}>Cancel</ActionButton><ActionButton variant="primary" onClick={startRefresh}>Start Refresh</ActionButton></div></div></div>}
    </div>
  );
}

function BookIdentity({ book }: { book: ReviewQueueBook }) {
  const cover = resolveCoverUrl(book.cover_url ?? undefined);
  return <div className="flex min-w-0 items-center gap-3">{cover ? <img src={cover} alt="" className="h-14 w-10 shrink-0 rounded object-cover" /> : <div aria-hidden="true" className="h-14 w-10 shrink-0 rounded bg-gray-800" />}<div className="min-w-0"><div className="truncate font-medium text-text-primary">{book.title}</div><div className="truncate text-xs text-text-secondary">{book.author}</div>{book.isbn && <div className="mt-0.5 truncate text-[10px] text-text-muted">{book.isbn}</div>}</div></div>;
}

function eligible(state: string, reason: string) {
  return state !== "current" && (reason === "all" || (reason === "changed" ? state === "changed" : state === "never_reviewed"));
}

function firstTarget(book: ReviewQueueBook, aspect: "all" | "metadata" | "covers", reason: string): ReviewTarget {
  return (aspect === "all" || aspect === "metadata") && eligible(book.metadata_review.state, reason) ? "metadata" : "covers";
}

function followUpTarget(book: ReviewQueueBook, target: ReviewTarget, aspect: "all" | "metadata" | "covers", reason: string): ReviewTarget | null {
  if (target !== "metadata") return null;
  return (aspect === "all" || aspect === "covers") && eligible(book.cover_review.state, reason) ? "covers" : null;
}
