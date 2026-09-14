import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronRight, GripVertical, Layers3 } from "lucide-react";
import toast from "react-hot-toast";

import {
  addSeriesMembership,
  removeSeriesMembership,
  seriesApiErrorMessage,
} from "../../../api/series";
import type { EffectiveSeriesBook, SeriesTreeNode } from "../../../types/series";
import { ActionButton } from "../../ui/ActionButton";
import { Dialog } from "../../ui/Dialog";
import { flattenSeries } from "./seriesTree";

type DraggedBook = {
  bookId: number;
  sourceSectionId: number | null;
  sourceMembershipIds: number[];
  membershipIds: number[];
};

type Props = {
  group: SeriesTreeNode;
  rootId: number;
  books: EffectiveSeriesBook[];
  onChanged: () => void | Promise<void>;
  onAssignBooks: (seriesId: number) => void;
  onAddRootBook: () => void;
};

function descendantIdSet(node: SeriesTreeNode) {
  return new Set(flattenSeries([node]).map((item) => item.id));
}

export function GroupSeriesStructure({ group, rootId, books, onChanged, onAssignBooks, onAddRootBook }: Props) {
  const childSeries = useMemo(
    () => group.children.filter((child) => child.node_type === "series"),
    [group.children],
  );
  const groupIds = useMemo(() => descendantIdSet(group), [group]);
  const branchIds = useMemo(
    () => new Map(childSeries.map((child) => [child.id, descendantIdSet(child)])),
    [childSeries],
  );
  const contextBooks = useMemo(() => books.filter((book) => (
    group.id === rootId || book.explicit_memberships.some((membership) => groupIds.has(membership.series_id))
  )), [books, group.id, groupIds, rootId]);
  const booksBySection = useMemo(() => new Map(childSeries.map((child) => {
    const ids = branchIds.get(child.id) ?? new Set<number>();
    return [child.id, contextBooks.filter((book) => book.explicit_memberships.some((membership) => ids.has(membership.series_id)))] as const;
  })), [branchIds, childSeries, contextBooks]);
  const assignedBookIds = useMemo(() => new Set(
    [...booksBySection.values()].flat().map((book) => book.book_id),
  ), [booksBySection]);
  const standaloneBooks = useMemo(
    () => contextBooks.filter((book) => !assignedBookIds.has(book.book_id)),
    [assignedBookIds, contextBooks],
  );

  const [collapsed, setCollapsed] = useState<Set<number | "standalone">>(new Set());
  const [dragged, setDragged] = useState<DraggedBook | null>(null);
  const [dropTarget, setDropTarget] = useState<number | "standalone" | null>(null);
  const [changing, setChanging] = useState(false);
  const [addingAnother, setAddingAnother] = useState<EffectiveSeriesBook | null>(null);
  const [additionalTargetId, setAdditionalTargetId] = useState<number | null>(null);

  function dragPayload(book: EffectiveSeriesBook, sourceSectionId: number | null): DraggedBook {
    const sourceIds = sourceSectionId === null ? new Set<number>() : branchIds.get(sourceSectionId) ?? new Set<number>();
    return {
      bookId: book.book_id,
      sourceSectionId,
      sourceMembershipIds: book.explicit_memberships
        .filter((membership) => sourceIds.has(membership.series_id))
        .map((membership) => membership.series_id),
      membershipIds: book.explicit_memberships.map((membership) => membership.series_id),
    };
  }

  async function moveBook(targetSectionId: number | null) {
    const current = dragged;
    setDropTarget(null);
    if (!current || changing || current.sourceSectionId === targetSectionId) return;
    setChanging(true);
    const targetIds = targetSectionId === null ? new Set<number>() : branchIds.get(targetSectionId) ?? new Set<number>();
    const alreadyInTarget = current.membershipIds.some((seriesId) => targetIds.has(seriesId));
    let targetAdded = false;
    try {
      if (targetSectionId !== null && !alreadyInTarget) {
        await addSeriesMembership(targetSectionId, current.bookId);
        targetAdded = true;
      }
      if (current.sourceSectionId !== null) {
        await Promise.all(current.sourceMembershipIds.map((seriesId) => removeSeriesMembership(seriesId, current.bookId)));
      }
      await onChanged();
      toast.success(targetSectionId === null ? "Series assignment removed" : "Book moved to Series");
    } catch (error) {
      if (targetAdded && targetSectionId !== null) {
        try { await removeSeriesMembership(targetSectionId, current.bookId); } catch { /* Refresh below exposes any rollback failure. */ }
      }
      toast.error(seriesApiErrorMessage(error, "Unable to move book."));
      await onChanged();
    } finally {
      setChanging(false);
      setDragged(null);
    }
  }

  async function confirmAdditionalMembership() {
    if (!addingAnother || additionalTargetId === null || changing) return;
    setChanging(true);
    try {
      await addSeriesMembership(additionalTargetId, addingAnother.book_id);
      await onChanged();
      setAddingAnother(null);
      setAdditionalTargetId(null);
      toast.success("Additional Series membership added");
    } catch (error) {
      toast.error(seriesApiErrorMessage(error, "Unable to add Series membership."));
    } finally {
      setChanging(false);
    }
  }

  function dropHandlers(target: number | "standalone") {
    return {
      onDragEnter: (event: React.DragEvent) => { event.preventDefault(); setDropTarget(target); },
      onDragOver: (event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; },
      onDragLeave: (event: React.DragEvent) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropTarget(null);
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        void moveBook(target === "standalone" ? null : target);
      },
    };
  }

  const availableAdditionalTargets = addingAnother ? childSeries.filter((series) => (
    !addingAnother.explicit_memberships.some((membership) => (branchIds.get(series.id) ?? new Set()).has(membership.series_id))
  )) : [];

  return (
    <section className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5" aria-label={`${group.name} books and Series structure`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold text-text-primary">Books + Series Structure</h4>
          <p className="mt-0.5 text-sm text-text-muted">Drag books between sections to organise this collection.</p>
        </div>
        <ActionButton variant="addPrimary" size="sm" onClick={onAddRootBook}>Add Book</ActionButton>
      </div>

      <div className="mt-3 grid items-start gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]">
        {childSeries.map((series) => {
          const sectionBooks = booksBySection.get(series.id) ?? [];
          const isCollapsed = collapsed.has(series.id);
          const highlighted = dropTarget === series.id;
          return (
            <section
              key={series.id}
              {...dropHandlers(series.id)}
              className={`min-w-0 rounded-xl border bg-surface-muted/20 transition ${highlighted ? "border-focus ring-2 ring-focus/30" : "border-border"}`}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(series.id)) next.delete(series.id); else next.add(series.id);
                    return next;
                  })}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={!isCollapsed}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span className="truncate font-medium text-text-primary">{series.name}</span>
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-muted">{sectionBooks.length}</span>
                </button>
                <ActionButton size="sm" variant="secondary" onClick={() => onAssignBooks(series.id)}>Assign Books</ActionButton>
              </div>
              {!isCollapsed && (
                <div className="border-t border-border px-3 py-2">
                  {sectionBooks.length ? (
                    <div className="space-y-1.5">
                      {sectionBooks.map((book) => <StructureBook key={book.book_id} book={book} changing={changing} onDragStart={() => setDragged(dragPayload(book, series.id))} onAddAnother={() => { setAddingAnother(book); setAdditionalTargetId(null); }} />)}
                    </div>
                  ) : <DropHint label="No books assigned. Drag a book here." />}
                </div>
              )}
            </section>
          );
        })}

        <section
          {...dropHandlers("standalone")}
          className={`min-w-0 rounded-xl border bg-surface transition ${dropTarget === "standalone" ? "border-focus ring-2 ring-focus/30" : "border-border"}`}
        >
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={() => setCollapsed((current) => {
                const next = new Set(current);
                if (next.has("standalone")) next.delete("standalone"); else next.add("standalone");
                return next;
              })}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
              aria-expanded={!collapsed.has("standalone")}
            >
              {collapsed.has("standalone") ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              <Layers3 size={16} className="shrink-0 text-text-muted" />
              <span className="font-medium text-text-primary">Standalone Books</span>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-text-muted">{standaloneBooks.length}</span>
            </button>
          </div>
          {!collapsed.has("standalone") && (
            <div className="border-t border-border px-3 py-2">
              {standaloneBooks.length ? <div className="space-y-1.5">{standaloneBooks.map((book) => <StructureBook key={book.book_id} book={book} changing={changing} onDragStart={() => setDragged(dragPayload(book, null))} onAddAnother={() => { setAddingAnother(book); setAdditionalTargetId(null); }} />)}</div> : <DropHint label="No standalone books. Drag a Series book here to remove its Series assignment." />}
            </div>
          )}
        </section>
      </div>

      <Dialog open={addingAnother !== null} title="Add to another Series" onClose={() => !changing && setAddingAnother(null)} className="max-w-md">
        <div className="p-5">
          <p className="rounded-lg border border-warning/30 bg-warning-muted/30 p-3 text-sm text-text-secondary">
            This adds another Series membership. “{addingAnother?.title}” will remain in its existing Series.
          </p>
          <label className="mt-4 block text-sm font-medium text-text-primary">
            Additional Series
            <select className="form-control mt-2 w-full" value={additionalTargetId ?? ""} onChange={(event) => setAdditionalTargetId(event.target.value ? Number(event.target.value) : null)}>
              <option value="">Select a Series…</option>
              {availableAdditionalTargets.map((series) => <option key={series.id} value={series.id}>{series.name}</option>)}
            </select>
          </label>
          {availableAdditionalTargets.length === 0 && <p className="mt-3 text-sm text-text-muted">This book already belongs to every child Series.</p>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <ActionButton className="w-full sm:w-auto" onClick={() => setAddingAnother(null)} disabled={changing}>Cancel</ActionButton>
            <ActionButton className="w-full sm:w-auto" variant="primary" onClick={() => void confirmAdditionalMembership()} disabled={additionalTargetId === null || changing}>{changing ? "Adding…" : "Confirm additional membership"}</ActionButton>
          </div>
        </div>
      </Dialog>
    </section>
  );
}

function StructureBook({ book, changing, onDragStart, onAddAnother }: { book: EffectiveSeriesBook; changing: boolean; onDragStart: () => void; onAddAnother: () => void }) {
  return (
    <div draggable={!changing} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(book.book_id)); onDragStart(); }} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-2">
      <GripVertical size={15} className="shrink-0 cursor-grab text-text-muted" aria-hidden="true" />
      <span className="flex h-10 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-surface-muted text-text-muted">{book.cover_url ? <img src={book.cover_url} alt="" className="h-full w-full object-cover" /> : <BookOpen size={13} />}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-text-primary">{book.title}</span><span className="block truncate text-xs text-text-muted">{book.author}</span></span>
      <ActionButton size="sm" variant="tertiary" onClick={onAddAnother}>Add to another Series</ActionButton>
    </div>
  );
}

function DropHint({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-text-muted">{label}</p>;
}
