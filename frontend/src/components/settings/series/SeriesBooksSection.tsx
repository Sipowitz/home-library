import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { BookOpen, GripVertical, ListX, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { getBooks } from "../../../api/books";
import {
  addSeriesMembership,
  fetchEffectiveSeriesBooks,
  removeSeriesMembership,
  replaceReadingOrder,
  replaceRootOrder,
  resetReadingOrder,
  seriesApiErrorMessage,
} from "../../../api/series";
import type { Book } from "../../../types/book";
import type { EffectiveSeriesBook } from "../../../types/series";
import { ActionButton } from "../../ui/ActionButton";
import { Dialog } from "../../ui/Dialog";

type Props = {
  seriesId: number;
  seriesName: string;
  nodeType: "group" | "series";
  isRoot: boolean;
  onMembershipsChanged: () => void | Promise<void>;
};

type OrderKind = "publication" | "chronological";

function sortByPosition(books: EffectiveSeriesBook[], field: keyof EffectiveSeriesBook) {
  return [...books].sort((a, b) => Number(a[field] ?? 1e9) - Number(b[field] ?? 1e9) || a.title.localeCompare(b.title));
}

function DraggableList({ books, onChange, removable = false, onRemove }: {
  books: EffectiveSeriesBook[];
  onChange: (books: EffectiveSeriesBook[]) => void;
  removable?: boolean;
  onRemove?: (book: EffectiveSeriesBook) => void;
}) {
  const [dragged, setDragged] = useState<number | null>(null);
  return <div className="space-y-2">
    {books.map((book, index) => <div key={book.book_id} draggable onDragStart={() => setDragged(book.book_id)} onDragEnd={() => setDragged(null)}
      onDragOver={(event) => event.preventDefault()} onDrop={() => {
        if (dragged === null || dragged === book.book_id) return;
        const next = [...books]; const from = next.findIndex((item) => item.book_id === dragged);
        const [item] = next.splice(from, 1); next.splice(index, 0, item); onChange(next);
      }} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2">
      <GripVertical size={16} className="cursor-grab text-text-muted" aria-hidden="true" />
      <span className="w-6 text-right text-xs tabular-nums text-text-muted">{index + 1}</span>
      <BookIdentity book={book} />
      {removable && <ActionButton size="sm" variant="secondary" onClick={() => onRemove?.(book)} aria-label={`Move ${book.title} to Unordered`}><ListX size={14} /> Unorder</ActionButton>}
    </div>)}
  </div>;
}

export function SeriesBooksSection({ seriesId, seriesName, nodeType, isRoot, onMembershipsChanged }: Props) {
  const [books, setBooks] = useState<EffectiveSeriesBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<OrderKind>("publication");
  const [ordered, setOrdered] = useState<EffectiveSeriesBook[]>([]);
  const [saving, setSaving] = useState(false);
  const [customising, setCustomising] = useState(false);
  const [showRootPositions, setShowRootPositions] = useState(false);
  const [removing, setRemoving] = useState<EffectiveSeriesBook | null>(null);
  const [removeWarning, setRemoveWarning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const next = await fetchEffectiveSeriesBooks(seriesId); setBooks(next); setError(null); }
    catch (requestError) { setError(seriesApiErrorMessage(requestError, "Unable to load Collection books.")); }
    finally { setLoading(false); }
  }, [seriesId]);
  useEffect(() => { void load(); }, [load]);

  const hasCustomReading = books.some((book) => book.reading_order_custom);
  useEffect(() => {
    const field = isRoot ? `${tab}_order` as keyof EffectiveSeriesBook : (hasCustomReading ? "reading_order" : "publication_order");
    setOrdered(sortByPosition(books.filter((book) => book[field] !== null), field));
  }, [books, hasCustomReading, isRoot, tab]);

  const unordered = useMemo(() => {
    const ids = new Set(ordered.map((book) => book.book_id));
    return books.filter((book) => !ids.has(book.book_id)).sort((a, b) => a.title.localeCompare(b.title));
  }, [books, ordered]);

  async function saveOrder() {
    setSaving(true);
    try {
      const readingIds = [...ordered, ...unordered].map((book) => book.book_id);
      const next = customising ? await replaceReadingOrder(seriesId, readingIds) : isRoot ? await replaceRootOrder(seriesId, tab, ordered.map((book) => book.book_id)) : await replaceReadingOrder(seriesId, readingIds);
      setBooks(next); setCustomising(false); toast.success(`${customising || !isRoot ? "Reading" : `${tab[0].toUpperCase()}${tab.slice(1)}`} order saved`);
      await onMembershipsChanged();
    } catch (requestError) { toast.error(seriesApiErrorMessage(requestError, "Unable to save order.")); }
    finally { setSaving(false); }
  }

  function beginCustomisingReading() {
    const field = hasCustomReading ? "reading_order" : "publication_order";
    const sequenced = sortByPosition(books.filter((book) => book[field] !== null), field);
    const ids = new Set(sequenced.map((book) => book.book_id));
    setOrdered([...sequenced, ...books.filter((book) => !ids.has(book.book_id)).sort((a, b) => a.title.localeCompare(b.title))]);
    setCustomising(true);
  }

  async function resetReading() {
    setSaving(true);
    try { await resetReadingOrder(seriesId); await load(); setCustomising(false); toast.success("Reading order reset to Publication order"); }
    catch (requestError) { toast.error(seriesApiErrorMessage(requestError, "Unable to reset Reading order.")); }
    finally { setSaving(false); }
  }

  async function confirmRemove(cascade = false) {
    if (!removing) return;
    try { await removeSeriesMembership(seriesId, removing.book_id, cascade); setRemoving(null); setRemoveWarning(null); await load(); await onMembershipsChanged(); toast.success(`Removed ${removing.title} from ${seriesName}`); }
    catch (requestError) {
      const message = seriesApiErrorMessage(requestError, "Unable to remove book.");
      if (isRoot && message.startsWith("Confirmation required")) setRemoveWarning(message); else toast.error(message);
    }
  }

  if (loading) return <p className="p-5 text-sm text-text-muted">Loading books…</p>;
  if (error) return <p role="alert" className="p-5 text-sm text-danger">{error}</p>;

  return <section className="p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h4 className="font-semibold text-text-primary">Books and Ordering</h4>
      {!isRoot && <label className="flex items-center gap-2 text-sm text-text-secondary"><input type="checkbox" checked={showRootPositions} onChange={(event) => setShowRootPositions(event.target.checked)} /> Show root positions</label>}
    </div>

    {books.length === 0 ? <p className="mt-5 text-sm text-text-muted">No books belong to this Collection yet.</p> : isRoot ? <>
      <div className="mt-5 flex gap-2" role="tablist">{(["publication", "chronological"] as const).map((kind) => <ActionButton key={kind} variant={tab === kind ? "primary" : "secondary"} onClick={() => setTab(kind)}>{kind === "publication" ? "Publication" : "Chronological"}</ActionButton>)}</div>
      <OrderColumns ordered={ordered} unordered={unordered} setOrdered={setOrdered} onRemoveMembership={setRemoving} />
      <div className="mt-4 flex justify-end"><ActionButton variant="primary" onClick={() => void saveOrder()} disabled={saving}>{saving ? "Saving…" : "Save order"}</ActionButton></div>
      {nodeType === "series" && <ReadingSummary custom={hasCustomReading} onCustomise={beginCustomisingReading} onReset={() => void resetReading()} />}
    </> : <>
      <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-text-muted"><th className="p-2">Book</th><th className="p-2">Publication</th><th className="p-2">Chronological</th><th className="p-2">Reading</th><th /></tr></thead><tbody>{books.map((book) => <tr key={book.book_id} className="border-b border-border/60"><td className="p-2"><BookIdentity book={book} /></td><td className="p-2">{positionLabel(book.publication_order, book.root_publication_order, showRootPositions)}</td><td className="p-2">{positionLabel(book.chronological_order, book.root_chronological_order, showRootPositions)}</td><td className="p-2">{book.reading_order ?? "Unordered"}</td><td className="p-2"><ActionButton size="iconSm" variant="danger" onClick={() => setRemoving(book)}><Trash2 size={14} /></ActionButton></td></tr>)}</tbody></table></div>
      <ReadingSummary custom={hasCustomReading} onCustomise={beginCustomisingReading} onReset={() => void resetReading()} />
    </>}

    <Dialog open={customising} title="Customise Reading Order" onClose={() => !saving && setCustomising(false)} className="max-w-2xl"><div className="p-5"><p className="mb-4 text-sm text-text-muted">Drag books into the preferred Reading order.</p><DraggableList books={[...ordered, ...unordered]} onChange={setOrdered} /><div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><ActionButton className="w-full sm:w-auto" onClick={() => setCustomising(false)}>Cancel</ActionButton><ActionButton className="w-full sm:w-auto" variant="primary" onClick={() => void saveOrder()} disabled={saving}>Save custom order</ActionButton></div></div></Dialog>
    <Dialog open={removing !== null} title={`Remove from ${seriesName}?`} onClose={() => { setRemoving(null); setRemoveWarning(null); }} className="max-w-md"><div className="p-5"><p className="text-sm text-text-secondary">Remove “{removing?.title}” from this {isRoot ? "root collection" : "Series"}?</p>{removeWarning && <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-muted/30 p-3 text-sm text-danger">{removeWarning}. Continuing removes those child assignments too.</p>}<div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><ActionButton className="w-full sm:w-auto" onClick={() => setRemoving(null)}>Cancel</ActionButton><ActionButton className="w-full sm:w-auto" variant="danger" onClick={() => void confirmRemove(Boolean(removeWarning))}>{removeWarning ? "Remove from root and child Series" : "Remove"}</ActionButton></div></div></Dialog>
  </section>;
}

function OrderColumns({ ordered, unordered, setOrdered, onRemoveMembership }: { ordered: EffectiveSeriesBook[]; unordered: EffectiveSeriesBook[]; setOrdered: (books: EffectiveSeriesBook[]) => void; onRemoveMembership: (book: EffectiveSeriesBook) => void }) {
  return <div className="mt-4 grid gap-5 lg:grid-cols-2"><div><h5 className="mb-2 text-sm font-semibold text-text-secondary">Ordered</h5><DraggableList books={ordered} onChange={setOrdered} removable onRemove={(book) => setOrdered(ordered.filter((item) => item.book_id !== book.book_id))} />{ordered.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-text-muted">No ordered books.</p>}</div><div><h5 className="mb-2 text-sm font-semibold text-text-secondary">Unordered</h5><div className="space-y-2">{unordered.map((book) => <div key={book.book_id} className="flex items-center gap-2 rounded-xl border border-border bg-surface-muted/30 p-2"><BookIdentity book={book} /><ActionButton size="sm" onClick={() => setOrdered([...ordered, book])}>Add to Ordered</ActionButton><ActionButton size="iconSm" variant="danger" onClick={() => onRemoveMembership(book)} aria-label={`Remove ${book.title} from root`}><Trash2 size={14} /></ActionButton></div>)}</div></div></div>;
}

function ReadingSummary({ custom, onCustomise, onReset }: { custom: boolean; onCustomise: () => void; onReset: () => void }) { return <div className="mt-6 rounded-xl border border-border bg-surface-muted/30 p-4"><p className="font-medium text-text-primary">Reading Order</p><p className="mt-1 text-sm text-text-muted">{custom ? "Custom Reading order" : "Publication order (default)"}</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><ActionButton className="w-full sm:w-auto" onClick={onCustomise}>{custom ? "Edit Reading Order" : "Customise Reading Order"}</ActionButton>{custom && <ActionButton className="w-full sm:w-auto" variant="secondary" onClick={onReset}>Reset to Publication Order</ActionButton>}</div></div>; }
function positionLabel(derived: number | null, root: number | null, showRoot: boolean) { return derived === null ? "Unordered" : showRoot && root !== null ? `${derived} (${root})` : String(derived); }
function BookIdentity({ book }: { book: EffectiveSeriesBook }) { return <div className="flex min-w-0 flex-1 items-center gap-2"><div className="flex h-12 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted">{book.cover_url ? <img src={book.cover_url} alt="" className="h-full w-full object-cover" /> : <BookOpen size={14} />}</div><span className="min-w-0"><span className="block truncate font-medium text-text-primary">{book.title}</span><span className="block truncate text-xs text-text-muted">{book.author}</span></span></div>; }

export function AddBooksDialog({ open, seriesId, seriesName, assignmentCandidates, assignmentRootId, directBookIds, onClose, onAdded }: { open: boolean; seriesId: number; seriesName: string; assignmentCandidates?: EffectiveSeriesBook[]; assignmentRootId?: number; directBookIds: Set<number>; onClose: () => void; onAdded: (complete: boolean) => Promise<void> }) {
  const inputId = useId(); const [search, setSearch] = useState(""); const [results, setResults] = useState<Book[]>([]); const [selected, setSelected] = useState<Set<number>>(new Set()); const [adding, setAdding] = useState(false);
  const assigning = assignmentCandidates !== undefined;
  const assignmentResults = useMemo(() => {
    if (!assignmentCandidates) return [];
    const query = search.trim().toLocaleLowerCase();
    return assignmentCandidates.filter((book) => {
      if (directBookIds.has(book.book_id)) return false;
      if (!query) return true;
      return [book.title, book.author, book.isbn].some((value) => value?.toLocaleLowerCase().includes(query));
    });
  }, [assignmentCandidates, directBookIds, search]);
  useEffect(() => { if (!open || assigning) return; const timer = window.setTimeout(() => void getBooks(0, 50, search || undefined).then((response) => setResults(response.items)), 200); return () => window.clearTimeout(timer); }, [assigning, open, search]);
  async function add() { setAdding(true); const ids = [...selected]; const results = await Promise.allSettled(ids.map((id) => addSeriesMembership(seriesId, id))); const failed = ids.filter((_, index) => results[index].status === "rejected"); setSelected(new Set(failed)); await onAdded(!failed.length); setAdding(false); if (!failed.length) toast.success(`Added ${ids.length} book${ids.length === 1 ? "" : "s"} to ${seriesName}`); }
  const choices = assigning ? assignmentResults.map((book) => ({
    id: book.book_id,
    title: book.title,
    author: book.author,
    assignedTo: book.explicit_memberships
      .filter((membership) => membership.series_id !== assignmentRootId && membership.series_id !== seriesId)
      .map((membership) => membership.series_name),
  })) : results.map((book) => ({ id: book.id, title: book.title, author: book.author, assignedTo: [] }));
  return <Dialog open={open} title={`${assigning ? "Assign Books" : "Add Books"} to ${seriesName}`} onClose={onClose} className="max-w-xl"><div className="p-5"><label htmlFor={inputId} className="text-sm font-medium">{assigning ? "Search root collection" : "Search your library"}</label><div className="relative mt-2"><Search className="absolute left-3 top-3 text-text-muted" size={16} /><input id={inputId} value={search} onChange={(event) => setSearch(event.target.value)} className="form-control w-full pl-9" /></div><div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto">{choices.map((book) => { const disabled = directBookIds.has(book.id); return <label key={book.id} className="flex items-center gap-3 rounded-xl border border-border p-3"><input type="checkbox" disabled={disabled || adding} checked={selected.has(book.id)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(book.id)) next.delete(book.id); else next.add(book.id); return next; })} /><span className="min-w-0 flex-1 text-sm"><span className="block truncate">{book.title} · {book.author}</span>{book.assignedTo.length > 0 && <span className="mt-0.5 block truncate text-xs text-text-muted">Assigned to: {book.assignedTo.join(", ")}</span>}</span>{disabled && <span className="text-xs text-text-muted">Already added</span>}</label>; })}</div><div className="mt-5 flex justify-end gap-2"><ActionButton onClick={onClose}>Cancel</ActionButton><ActionButton variant="addPrimary" disabled={!selected.size || adding} onClick={() => void add()}>{adding ? (assigning ? "Assigning…" : "Adding…") : (assigning ? "Assign Books" : "Add Books")}</ActionButton></div></div></Dialog>;
}
