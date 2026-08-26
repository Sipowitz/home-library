import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import type { ReviewQueueBook } from "../../../api/maintenance";
import { getReviewQueue } from "../../../api/maintenance";
import { useMaintenance } from "../../../hooks/useMaintenance";
import { resolveCoverUrl } from "../../books/BookView";

export type ReviewTarget = "book" | "metadata" | "covers";

type Props = {
  active: boolean;
  reviewSaved?: { bookId: number; nonce: number } | null;
  onReview: (bookId: number, target: ReviewTarget) => void;
  onReviewSequenceComplete: () => void;
};

function label(state: string) {
  if (state === "current") return "Reviewed";
  if (state === "changed") return "Changed since review";
  return "Never reviewed";
}

function tone(state: string) {
  if (state === "current") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  if (state === "changed") return "border-amber-500/25 bg-amber-500/10 text-amber-200";
  return "border-slate-600 bg-slate-800/70 text-slate-300";
}

function StatusButton({ book, target }: { book: ReviewQueueBook; target: "metadata" | "covers" }) {
  const status = target === "metadata" ? book.metadata_review : book.cover_review;
  return (
    <span className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${tone(status.state)}`}>
      {label(status.state)}
    </span>
  );
}

export function MaintenanceSettings({ active, reviewSaved, onReview, onReviewSequenceComplete }: Props) {
  const queue = useMaintenance(active);
  const handledSaveRef = useRef<number | null>(null);

  async function openFirstEligible(excludeBookId?: number) {
    const result = await getReviewQueue({
      skip: 0,
      limit: excludeBookId == null ? 1 : 2,
      aspect: queue.aspect,
      reason: queue.reason,
      search: queue.search.trim() || undefined,
    });
    const next = result.items.find((item) => item.id !== excludeBookId);
    if (next) onReview(next.id, "book");
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
          <div className="flex items-baseline gap-2">
            <h2 className="text-lg font-semibold">Maintenance</h2>
            {summary && <span className="text-sm text-gray-400">{summary.total} books</span>}
          </div>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">
            Review current provider evidence for existing books. Changed since review means provider metadata or available provider cover choices changed; your saved book and active cover were not changed automatically.
          </p>
        </div>
        <button
          type="button"
          disabled={!items.length || queue.loading}
          onClick={() => openFirstEligible().catch((err) => console.error("Failed to open next review", err))}
          className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Review Next
        </button>
      </div>

      <section aria-labelledby="review-queue-heading" className="rounded-xl border border-gray-800 bg-gray-900/60 p-3 sm:p-4">
        <h3 id="review-queue-heading" className="text-sm font-semibold text-white">Review Queue</h3>
        {summary && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Review queue summary">
            <div className="rounded-lg bg-gray-950/60 p-3"><div className="text-xs text-gray-500">Metadata · Never reviewed</div><div className="mt-1 text-xl font-semibold">{summary.metadata_never_reviewed}</div></div>
            <div className="rounded-lg bg-gray-950/60 p-3"><div className="text-xs text-gray-500">Metadata · Changed</div><div className="mt-1 text-xl font-semibold">{summary.metadata_changed}</div></div>
            <div className="rounded-lg bg-gray-950/60 p-3"><div className="text-xs text-gray-500">Covers · Never reviewed</div><div className="mt-1 text-xl font-semibold">{summary.cover_never_reviewed}</div></div>
            <div className="rounded-lg bg-gray-950/60 p-3"><div className="text-xs text-gray-500">Covers · Changed</div><div className="mt-1 text-xl font-semibold">{summary.cover_changed}</div></div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="flex rounded-lg border border-gray-700 bg-gray-950 p-1" aria-label="Review aspect filter">
            {(["all", "metadata", "covers"] as const).map((value) => (
              <button key={value} type="button" onClick={() => queue.setAspect(value)} className={`min-h-9 flex-1 rounded-md px-3 text-xs capitalize sm:flex-none ${queue.aspect === value ? "bg-gray-700 text-white" : "text-gray-400 hover:text-white"}`}>{value}</button>
            ))}
          </div>
          <select aria-label="Review reason" value={queue.reason} onChange={(event) => queue.setReason(event.target.value as typeof queue.reason)} className="min-h-11 rounded-lg border border-gray-700 bg-gray-950 px-3 text-sm text-gray-200">
            <option value="all">All reasons</option><option value="never_reviewed">Never reviewed</option><option value="changed">Changed</option>
          </select>
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search review queue by title, author, or ISBN</span>
            <Search aria-hidden="true" size={16} className="absolute left-3 top-3.5 text-gray-500" />
            <input value={queue.search} onChange={(event) => queue.setSearch(event.target.value)} placeholder="Search title, author, or ISBN" className="min-h-11 w-full rounded-lg border border-gray-700 bg-gray-950 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
          </label>
        </div>

        <div className="mt-3 min-h-20" aria-live="polite">
          {queue.loading && !queue.data ? <p className="py-8 text-center text-sm text-gray-400">Loading review queue…</p> : queue.error ? <p role="alert" className="py-8 text-center text-sm text-red-300">{queue.error}</p> : items.length === 0 ? (
            <div className="py-10 text-center"><h4 className="font-medium text-emerald-300">Everything is reviewed</h4><p className="mt-1 text-sm text-gray-400">All current metadata and cover choices in this view have been reviewed.</p></div>
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-lg border border-gray-800 md:block">
                <table className="w-full text-left text-sm"><thead className="bg-gray-950/80 text-xs text-gray-500"><tr><th className="px-3 py-2 font-medium">Book</th><th className="px-3 py-2 font-medium">Metadata</th><th className="px-3 py-2 font-medium">Covers</th><th className="px-3 py-2 text-right font-medium">Action</th></tr></thead>
                  <tbody className="divide-y divide-gray-800">{items.map((book) => <tr key={book.id} className="bg-gray-900/30"><td className="px-3 py-2"><BookIdentity book={book} /></td><td className="px-3 py-2"><button type="button" aria-label={`Review metadata for ${book.title}`} onClick={() => onReview(book.id, "metadata")}><StatusButton book={book} target="metadata" /></button></td><td className="px-3 py-2"><button type="button" aria-label={`Review covers for ${book.title}`} onClick={() => onReview(book.id, "covers")}><StatusButton book={book} target="covers" /></button></td><td className="px-3 py-2 text-right"><ReviewButton book={book} onReview={onReview} /></td></tr>)}</tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">{items.map((book) => <article key={book.id} className="rounded-lg border border-gray-800 bg-gray-950/50 p-3"><BookIdentity book={book} /><div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-xs"><span className="text-gray-500">Metadata</span><button type="button" className="justify-self-start" onClick={() => onReview(book.id, "metadata")} aria-label={`Review metadata for ${book.title}`}><StatusButton book={book} target="metadata" /></button><span className="text-gray-500">Covers</span><button type="button" className="justify-self-start" onClick={() => onReview(book.id, "covers")} aria-label={`Review covers for ${book.title}`}><StatusButton book={book} target="covers" /></button></div><div className="mt-3"><ReviewButton book={book} onReview={onReview} full /></div></article>)}</div>
            </>
          )}
        </div>

        {(queue.data?.total ?? 0) > queue.pageSize && <div className="mt-3 flex items-center justify-end gap-2 text-xs text-gray-400"><button aria-label="Previous review queue page" disabled={queue.page === 0} onClick={() => queue.setPage((page) => page - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 disabled:opacity-40"><ChevronLeft size={16} /></button><span>Page {queue.page + 1} of {totalPages}</span><button aria-label="Next review queue page" disabled={queue.page + 1 >= totalPages} onClick={() => queue.setPage((page) => page + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-700 disabled:opacity-40"><ChevronRight size={16} /></button></div>}
      </section>
    </div>
  );
}

function BookIdentity({ book }: { book: ReviewQueueBook }) {
  const cover = resolveCoverUrl(book.cover_url ?? undefined);
  return <div className="flex min-w-0 items-center gap-3">{cover ? <img src={cover} alt="" className="h-14 w-10 shrink-0 rounded object-cover" /> : <div aria-hidden="true" className="h-14 w-10 shrink-0 rounded bg-gray-800" />}<div className="min-w-0"><div className="truncate font-medium text-gray-100">{book.title}</div><div className="truncate text-xs text-gray-400">{book.author}</div>{book.isbn && <div className="mt-0.5 truncate text-[10px] text-gray-600">{book.isbn}</div>}</div></div>;
}

function ReviewButton({ book, onReview, full = false }: { book: ReviewQueueBook; onReview: Props["onReview"]; full?: boolean }) {
  return <button type="button" aria-label={`Review ${book.title}`} onClick={() => onReview(book.id, "book")} className={`${full ? "w-full" : ""} min-h-10 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold text-blue-300 hover:bg-blue-500/20`}>Review</button>;
}
