import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BookOpen, FolderTree, GitBranch, Plus, X } from "lucide-react";
import toast from "react-hot-toast";

import {
  createSeries,
  deleteSeries,
  fetchEffectiveSeriesBooks,
  fetchSeriesTree,
  seriesApiErrorMessage,
  updateSeries,
} from "../../../api/series";

import type { EffectiveSeriesBook, SeriesTreeNode } from "../../../types/series";

import { ActionButton } from "../../ui/ActionButton";
import { Dialog } from "../../ui/Dialog";
import { ConfirmDeleteModal } from "../ConfirmDeleteModal";

import { MobileSeriesTree } from "./MobileSeriesTree";
import { AddBooksDialog, SeriesBooksSection } from "./SeriesBooksSection";
import { GroupSeriesStructure } from "./GroupSeriesStructure";
import { SeriesForm, type SeriesDraft } from "./SeriesForm";
import { SeriesRootCombobox } from "./SeriesRootCombobox";
import { SeriesTreeFlow } from "./SeriesTreeFlow";
import {
  flattenSeries,
  type SeriesBookLeafSelection,
  type SeriesTreeOrder,
} from "./seriesTree";

const emptyDraft = (parentId: number | null = null): SeriesDraft => ({
  name: "",
  nodeType: "series",
  author: "",
  description: "",
  coverUrl: "",
  parentId,
});

function rootIdForSeries(tree: SeriesTreeNode[], seriesId: number): number | null {
  for (const root of tree) {
    if (flattenSeries([root]).some((series) => series.id === seriesId)) return root.id;
  }
  return null;
}

type Props = {
  onViewBook?: (bookId: number) => void;
  onCollectionsChanged?: () => void;
};

export function SeriesSettings({ onViewBook, onCollectionsChanged }: Props) {
  const [tree, setTree] = useState<SeriesTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(null);
  const [rootBooks, setRootBooks] = useState<EffectiveSeriesBook[]>([]);
  const [rootBooksRevision, setRootBooksRevision] = useState(0);
  const [treeOrder, setTreeOrder] = useState<SeriesTreeOrder>("publication");
  const [groupView, setGroupView] = useState<"structure" | "ordering">("structure");
  const [managementOpen, setManagementOpen] = useState(false);
  const [selectedBookLeaf, setSelectedBookLeaf] = useState<SeriesBookLeafSelection | null>(null);
  const [addBookSeriesId, setAddBookSeriesId] = useState<number | null>(null);
  const selectedBookLeafRef = useRef<SeriesBookLeafSelection | null>(null);

  const [creating, setCreating] = useState(false);
  const [choosingRootType, setChoosingRootType] = useState(false);
  const [createDraft, setCreateDraft] = useState<SeriesDraft>(emptyDraft());
  const [createError, setCreateError] = useState<string | null>(null);
  const [savingCreate, setSavingCreate] = useState(false);

  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState<SeriesDraft>(emptyDraft());
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const flatSeries = useMemo(() => flattenSeries(tree), [tree]);
  const selected = useMemo(
    () => flatSeries.find((series) => series.id === selectedId) ?? null,
    [flatSeries, selectedId],
  );
  const visibleRoot = tree.find((root) => root.id === selectedRootId) ?? tree[0] ?? null;
  const selectedBookContext = useMemo(() => {
    if (!selectedBookLeaf) return null;
    const book = rootBooks.find((candidate) => candidate.book_id === selectedBookLeaf.bookId);
    const membership = book?.explicit_memberships.find(
      (candidate) => candidate.series_id === selectedBookLeaf.seriesId,
    );
    const series = flatSeries.find((candidate) => candidate.id === selectedBookLeaf.seriesId);
    if (!book || !membership || !series) return null;
    return { book, membership, series };
  }, [flatSeries, rootBooks, selectedBookLeaf]);

  useEffect(() => {
    let cancelled = false;

    if (!visibleRoot) {
      setRootBooks([]);
      return;
    }

    void fetchEffectiveSeriesBooks(visibleRoot.id)
      .then((books) => {
        if (cancelled) return;
        setRootBooks(books);
        const currentLeaf = selectedBookLeafRef.current;
        if (!currentLeaf) return;
        const book = books.find((candidate) => candidate.book_id === currentLeaf.bookId);
        const membership = book?.explicit_memberships.find(
          (candidate) => candidate.series_id === currentLeaf.seriesId,
        );
        if (membership) {
          const refreshed = { ...currentLeaf };
          selectedBookLeafRef.current = refreshed;
          setSelectedBookLeaf(refreshed);
        } else {
          selectedBookLeafRef.current = null;
          setSelectedBookLeaf(null);
          setSelectedId(currentLeaf.seriesId);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRootBooks([]);
          const currentLeaf = selectedBookLeafRef.current;
          if (currentLeaf) {
            selectedBookLeafRef.current = null;
            setSelectedBookLeaf(null);
            setSelectedId(currentLeaf.seriesId);
          }
        }
      });

    return () => {
      cancelled = true;
    };
  }, [rootBooksRevision, visibleRoot]);

  const reload = useCallback(async (preferredId?: number | null) => {
    const nextTree = await fetchSeriesTree();
    setTree(nextTree);
    setLoadError(null);

    if (preferredId !== undefined) {
      const exists = flattenSeries(nextTree).some((series) => series.id === preferredId);
      const nextSelectedId = exists ? preferredId : null;
      const nextRootId = nextSelectedId === null
        ? nextTree[0]?.id ?? null
        : rootIdForSeries(nextTree, nextSelectedId);
      setSelectedId(nextSelectedId ?? nextRootId);
      setSelectedRootId(nextRootId);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextTree = await fetchSeriesTree();
        if (!cancelled) {
          setTree(nextTree);
          const firstRootId = nextTree[0]?.id ?? null;
          setSelectedRootId(firstRootId);
          setSelectedId(firstRootId);
          setLoadError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(seriesApiErrorMessage(error, "Unable to load Series."));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectSeries = useCallback((id: number | null) => {
    if (id !== null) {
      const rootId = rootIdForSeries(tree, id);
      if (rootId !== null) setSelectedRootId(rootId);
    }
    selectedBookLeafRef.current = null;
    setSelectedBookLeaf(null);
    setSelectedId(id);
    setGroupView("structure");
    if (id !== null) setManagementOpen(true);
    setEditing(false);
    setEditError(null);
    setOperationError(null);
  }, [tree]);

  const selectBookLeaf = useCallback((selection: SeriesBookLeafSelection) => {
    selectedBookLeafRef.current = selection;
    setSelectedBookLeaf(selection);
    setSelectedId(selection.seriesId);
    setManagementOpen(true);
    setEditing(false);
    setEditError(null);
    setOperationError(null);
  }, []);

  const openCreate = useCallback((parentId: number | null = null, nodeType: "group" | "series" = "series") => {
    setCreateDraft({ ...emptyDraft(parentId), nodeType });
    setCreateError(null);
    setCreating(true);
  }, []);

  async function handleCreate() {
    if (!createDraft.name.trim() || savingCreate) return;
    setSavingCreate(true);
    setCreateError(null);

    try {
      const created = await createSeries({
        name: createDraft.name.trim(),
        node_type: createDraft.nodeType,
        author: createDraft.author.trim() || null,
        description: createDraft.description.trim() || null,
        cover_url: createDraft.coverUrl.trim() || null,
        parent_id: createDraft.parentId,
      });
      onCollectionsChanged?.();
      await reload(created.id);
      setCreating(false);
      setCreateDraft(emptyDraft());
      toast.success("Series created");
    } catch (error) {
      const message = seriesApiErrorMessage(error, "Failed to create Series.");
      setCreateError(message);
      toast.error(message);
    } finally {
      setSavingCreate(false);
    }
  }

  const beginEdit = useCallback((series = selected) => {
    if (!series) return;
    setEditDraft({
      name: series.name,
      nodeType: series.node_type,
      author: series.author ?? "",
      description: series.description ?? "",
      coverUrl: series.cover_url ?? "",
      parentId: series.parent_id,
    });
    setEditError(null);
    setOperationError(null);
    setEditing(true);
  }, [selected]);

  async function handleUpdate() {
    if (!selected || !editDraft.name.trim() || savingEdit) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      await updateSeries(selected.id, {
        name: editDraft.name.trim(),
        author: editDraft.author.trim() || null,
        description: editDraft.description.trim() || null,
        cover_url: editDraft.coverUrl.trim() || null,
      });
      onCollectionsChanged?.();
      await reload(selected.id);
      setEditing(false);
      toast.success("Series updated");
    } catch (error) {
      const message = seriesApiErrorMessage(error, "Failed to update Series.");
      setEditError(message);
      toast.error(message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete() {
    if (!selected || deleting) return;
    const fallbackSelection = selected.parent_id;
    setDeleting(true);
    setOperationError(null);

    try {
      await deleteSeries(selected.id);
      onCollectionsChanged?.();
      await reload(fallbackSelection);
      setConfirmingDelete(false);
      setEditing(false);
      toast.success("Series deleted");
    } catch (error) {
      const message = seriesApiErrorMessage(error, "Failed to delete Series.");
      setOperationError(message);
      setConfirmingDelete(false);
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  const handleTreeAddBook = useCallback((seriesId: number) => {
    selectSeries(seriesId);
    setAddBookSeriesId(seriesId);
  }, [selectSeries]);
  const handleTreeManage = useCallback((seriesId: number) => {
    selectSeries(seriesId);
  }, [selectSeries]);
  const handleTreeAdd = useCallback((parentId: number) => {
    openCreate(parentId);
  }, [openCreate]);
  const handleTreeEdit = useCallback((id: number) => {
    const target = flatSeries.find((series) => series.id === id);
    if (!target) return;
    selectSeries(id);
    beginEdit(target);
  }, [beginEdit, flatSeries, selectSeries]);
  const handleTreeDelete = useCallback((id: number) => {
    selectSeries(id);
    setConfirmingDelete(true);
  }, [selectSeries]);

  if (loading) {
    return (
      <div className="flex min-h-72 items-center justify-center rounded-xl border border-border bg-surface-muted/30 text-sm text-text-muted">
        Loading Series…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center rounded-xl border border-border bg-surface-muted/30 px-5 text-center">
        <p role="alert" className="text-sm text-danger">{loadError}</p>
        <ActionButton
          variant="tertiary"
          className="mt-4"
          onClick={async () => {
            setLoading(true);
            try {
              await reload();
            } catch (error) {
              setLoadError(seriesApiErrorMessage(error, "Unable to load Series."));
            } finally {
              setLoading(false);
            }
          }}
        >
          Try again
        </ActionButton>
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <>
        <div className="flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface-muted/30 px-5 text-center">
          <div className="rounded-2xl border border-border bg-surface p-4 text-text-secondary">
            <GitBranch size={28} aria-hidden="true" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-text-primary">No Series yet</h3>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
            Create a Series to organise books into Series and subseries.
          </p>
          <ActionButton variant="addPrimary" className="mt-5" onClick={() => setChoosingRootType(true)}>
            <Plus size={17} aria-hidden="true" /> Create
          </ActionButton>
        </div>
        <CreateSeriesDialog
          open={creating}
          draft={createDraft}
          error={createError}
          saving={savingCreate}
          onChange={setCreateDraft}
          onClose={() => !savingCreate && setCreating(false)}
          onSubmit={handleCreate}
        />
        <RootTypeDialog open={choosingRootType} onClose={() => setChoosingRootType(false)} onChoose={(type) => { setChoosingRootType(false); openCreate(null, type); }} />
      </>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-border bg-surface-muted/30">
        <div className="relative z-20 rounded-t-xl border-b border-border bg-surface/60 px-2.5 py-2 sm:px-3 lg:px-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:flex-nowrap lg:items-center">
            <h3 className="hidden shrink-0 text-lg font-semibold text-text-primary lg:block">Series</h3>
            <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-1 lg:flex-nowrap">
              <SeriesRootCombobox
                roots={tree}
                selectedId={visibleRoot?.id ?? null}
                onSelect={(rootId) => {
                  setTreeOrder("publication");
                  selectSeries(rootId);
                }}
              />
              <label className="shrink-0">
                <span className="sr-only">Tree order</span>
                <select
                  aria-label="Tree order"
                  value={treeOrder}
                  onChange={(event) => setTreeOrder(event.target.value as SeriesTreeOrder)}
                  className="form-control rounded-xl px-3 py-2 text-sm"
                >
                  <option value="publication">Order: Publication</option>
                  <option value="chronological">Order: Chronological</option>
                  {visibleRoot?.node_type === "series" && <option value="reading">Order: Reading</option>}
                </select>
              </label>
              <button
                type="button"
                onClick={() => setChoosingRootType(true)}
                className="shrink-0 rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-3 py-2 text-sm font-medium text-white transition hover:brightness-110"
              >
                + Create
              </button>
            </div>
          </div>
        </div>

        <div className="relative min-h-[60vh] min-w-0 overflow-hidden rounded-b-xl lg:h-[76vh]">
          <div className="h-full min-w-0" inert={managementOpen} aria-hidden={managementOpen || undefined}>
            <div className="max-h-[68vh] overflow-y-auto p-2 lg:hidden">
              <MobileSeriesTree nodes={visibleRoot ? [visibleRoot] : []} selectedId={selectedId} onSelect={(id) => selectSeries(id)} />
            </div>
            <div className="hidden h-full lg:flex">
              <SeriesTreeFlow
                series={visibleRoot ? [visibleRoot] : []}
                books={rootBooks}
                order={treeOrder}
                selectedId={selectedBookLeaf ? null : selectedId}
                selectedBookLeafId={selectedBookLeaf?.leafId ?? null}
                onSelect={selectSeries}
                onSelectBook={selectBookLeaf}
                onAddBook={handleTreeAddBook}
                onManageBooks={handleTreeManage}
                searchTargetId={null}
                onAdd={handleTreeAdd}
                onEdit={handleTreeEdit}
                onDelete={handleTreeDelete}
              />
            </div>
          </div>

          {managementOpen && selected && (
            <>
              <div className="absolute inset-0 z-30 bg-black/30 backdrop-blur-[1px]" aria-hidden="true" />
              <section
                role="dialog"
                aria-modal="true"
                aria-label={`Manage ${selected.name}`}
                className="absolute inset-3 z-40 flex min-w-0 flex-col overflow-hidden rounded-xl border border-border-strong bg-surface-raised shadow-2xl sm:inset-5 lg:inset-6"
              >
                <header className="shrink-0 bg-surface px-4 pb-1 pt-2 sm:px-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-text-muted">Manage {selected.node_type === "group" ? "Group" : "Series"}</p>
                </header>
                <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 pb-2 sm:px-5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-11 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-text-muted">
                      {selected.cover_url ? (
                        <img src={selected.cover_url} alt={`${selected.name} cover`} className="h-full w-full object-cover" />
                      ) : selected.node_type === "group" ? (
                        <FolderTree size={16} aria-label="Group" />
                      ) : (
                        <BookOpen size={16} aria-label="No cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-text-primary">{selected.name}</h3>
                      <p className="text-xs text-text-muted">{selected.node_type === "group" ? "Group" : "Series"}</p>
                    </div>
                  </div>
                  {selected.node_type === "group" && !selectedBookContext && (
                    <div className="flex gap-2" role="tablist" aria-label="Group management view">
                      <ActionButton variant={groupView === "structure" ? "primary" : "secondary"} size="sm" onClick={() => setGroupView("structure")}>Books + Series</ActionButton>
                      <ActionButton variant={groupView === "ordering" ? "primary" : "secondary"} size="sm" onClick={() => setGroupView("ordering")}>Ordering</ActionButton>
                    </div>
                  )}
                  <ActionButton className="ml-auto" variant="secondary" size="sm" onClick={() => setManagementOpen(false)} aria-label="Close management panel">
                    <X size={16} aria-hidden="true" /> Close
                  </ActionButton>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
            <section aria-label="Selected Series item management">
              {operationError && (
                <div role="alert" className="mx-4 mt-3 rounded-xl border border-danger/30 bg-danger-muted/35 px-3 py-2 text-sm text-danger sm:mx-5">
                  {operationError}
                </div>
              )}

                {selectedBookContext && (
                <div className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
                  <div className="flex h-14 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted text-text-muted">
                    {selectedBookContext.book.cover_url ? (
                      <img src={selectedBookContext.book.cover_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <BookOpen size={18} aria-hidden="true" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-lg font-semibold text-text-primary">{selectedBookContext.book.title}</h3>
                    <p className="mt-0.5 break-words text-sm text-text-secondary">{selectedBookContext.book.author}</p>
                    <p className="mt-1 text-xs font-medium text-text-secondary">Member of {selectedBookContext.series.name}</p>
                    {(selectedBookContext.book.isbn || selectedBookContext.book.year) && (
                      <p className="mt-1 text-xs text-text-muted">
                        {[selectedBookContext.book.isbn ? `ISBN ${selectedBookContext.book.isbn}` : null, selectedBookContext.book.year]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="ml-auto flex shrink-0 flex-wrap gap-2">
                    {onViewBook && (
                      <ActionButton variant="primary" size="sm" onClick={() => onViewBook(selectedBookContext.book.book_id)}>
                        View Book
                      </ActionButton>
                    )}
                    <ActionButton variant="secondary" size="sm" onClick={() => selectSeries(selectedBookContext.series.id)}>
                      Manage Membership
                    </ActionButton>
                  </div>
                </div>
                )}

              {!selectedBookContext && selected.node_type === "group" && visibleRoot && (
                <>
                  {groupView === "structure" ? (
                    <GroupSeriesStructure
                      group={selected}
                      rootId={visibleRoot.id}
                      books={rootBooks}
                      onChanged={() => setRootBooksRevision((revision) => revision + 1)}
                      onAddRootBook={() => setAddBookSeriesId(visibleRoot.id)}
                      onAssignBooks={setAddBookSeriesId}
                    />
                  ) : (
                    <SeriesBooksSection
                      key={`${selected.id}-${rootBooksRevision}`}
                      seriesId={selected.id}
                      seriesName={selected.name}
                      nodeType={selected.node_type}
                      isRoot={selected.parent_id === null}
                      onMembershipsChanged={() => setRootBooksRevision((revision) => revision + 1)}
                    />
                  )}
                </>
              )}
              {!selectedBookContext && selected.node_type === "series" && (
                <>
                  <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-5">
                    <ActionButton variant="addPrimary" size="sm" onClick={() => setAddBookSeriesId(selected.id)}>{selected.parent_id === null ? "Add Book" : "Assign Books"}</ActionButton>
                  </div>
                  <SeriesBooksSection
                    key={`${selected.id}-${rootBooksRevision}`}
                    seriesId={selected.id}
                    seriesName={selected.name}
                    nodeType={selected.node_type}
                    isRoot={selected.parent_id === null}
                    onMembershipsChanged={() => setRootBooksRevision((revision) => revision + 1)}
                  />
                </>
              )}
            </section>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {addBookSeriesId !== null && (() => {
        const target = flatSeries.find((series) => series.id === addBookSeriesId);
        if (!target) return null;
        const isRoot = target.parent_id === null;
        const directBookIds = new Set(rootBooks
          .filter((book) => book.explicit_memberships.some((membership) => membership.series_id === target.id))
          .map((book) => book.book_id));
        return (
          <AddBooksDialog
            open
            seriesId={target.id}
            seriesName={target.name}
            assignmentCandidates={isRoot ? undefined : rootBooks}
            assignmentRootId={isRoot ? undefined : visibleRoot?.id}
            directBookIds={directBookIds}
            onClose={() => setAddBookSeriesId(null)}
            onAdded={async (complete) => {
              if (complete) setAddBookSeriesId(null);
              setRootBooksRevision((revision) => revision + 1);
            }}
          />
        );
      })()}

      <Dialog open={editing} title={`Edit ${selected?.node_type === "group" ? "Group" : "Series"}`} onClose={() => !savingEdit && setEditing(false)} className="max-w-xl">
        <div className="p-4 sm:p-5">
          <SeriesForm
            draft={editDraft}
            saving={savingEdit}
            error={editError}
            submitLabel="Save"
            onChange={setEditDraft}
            onCancel={() => {
              setEditing(false);
              setEditError(null);
            }}
            onSubmit={handleUpdate}
          />
        </div>
      </Dialog>

      <CreateSeriesDialog
        open={creating}
        draft={createDraft}
        error={createError}
        saving={savingCreate}
        onChange={setCreateDraft}
        onClose={() => !savingCreate && setCreating(false)}
        onSubmit={handleCreate}
      />
      <RootTypeDialog open={choosingRootType} onClose={() => setChoosingRootType(false)} onChoose={(type) => { setChoosingRootType(false); openCreate(null, type); }} />

      <ConfirmDeleteModal
        open={confirmingDelete}
        title={`Delete ${selected?.node_type === "group" ? "Group" : "Series"}?`}
        message={`Delete “${selected?.name ?? "this Series"}”? This cannot be undone.`}
        confirmText={deleting ? "Deleting…" : `Delete ${selected?.node_type === "group" ? "Group" : "Series"}`}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmingDelete(false)}
      />
    </>
  );
}

function RootTypeDialog({ open, onClose, onChoose }: { open: boolean; onClose: () => void; onChoose: (type: "group" | "series") => void }) {
  return <Dialog open={open} title="Create" onClose={onClose} className="max-w-sm"><div className="grid gap-3 p-5"><ActionButton variant="primary" onClick={() => onChoose("group")}><FolderTree size={16} /> Group</ActionButton><ActionButton variant="primary" onClick={() => onChoose("series")}><GitBranch size={16} /> Series</ActionButton></div></Dialog>;
}

type CreateDialogProps = {
  open: boolean;
  draft: SeriesDraft;
  error: string | null;
  saving: boolean;
  onChange: (draft: SeriesDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function CreateSeriesDialog({ open, draft, error, saving, onChange, onClose, onSubmit }: CreateDialogProps) {
  return (
    <Dialog open={open} title={draft.parentId === null ? `Create ${draft.nodeType === "group" ? "Group" : "Series"}` : "Add Series"} onClose={onClose} className="max-w-xl">
      <div className="p-4 sm:p-5">
        <SeriesForm
          draft={draft}
          saving={saving}
          error={error}
          submitLabel="Create"
          onChange={onChange}
          onCancel={onClose}
          onSubmit={onSubmit}
        />
      </div>
    </Dialog>
  );
}
