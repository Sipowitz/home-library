import { useCallback, useEffect, useMemo, useState } from "react";

import { BookOpen, GitBranch, Plus } from "lucide-react";
import toast from "react-hot-toast";

import {
  createSeries,
  deleteSeries,
  fetchSeriesTree,
  seriesApiErrorMessage,
  updateSeries,
} from "../../../api/series";

import type { SeriesTreeNode } from "../../../types/series";

import { ActionButton } from "../../ui/ActionButton";
import { Dialog } from "../../ui/Dialog";
import { ConfirmDeleteModal } from "../ConfirmDeleteModal";

import { MobileSeriesTree } from "./MobileSeriesTree";
import { SeriesBooksSection } from "./SeriesBooksSection";
import { SeriesForm, type SeriesDraft } from "./SeriesForm";
import { SeriesTreeFlow } from "./SeriesTreeFlow";
import {
  descendantIds,
  flattenSeries,
  seriesOptions,
} from "./seriesTree";

const emptyDraft = (parentId: number | null = null): SeriesDraft => ({
  name: "",
  author: "",
  description: "",
  parentId,
});

export function SeriesSettings() {
  const [tree, setTree] = useState<SeriesTreeNode[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
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

  const reload = useCallback(async (preferredId?: number | null) => {
    const nextTree = await fetchSeriesTree();
    setTree(nextTree);
    setLoadError(null);

    if (preferredId !== undefined) {
      const exists = flattenSeries(nextTree).some((series) => series.id === preferredId);
      setSelectedId(exists ? preferredId : null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextTree = await fetchSeriesTree();
        if (!cancelled) {
          setTree(nextTree);
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
    setSelectedId(id);
    setEditing(false);
    setEditError(null);
    setOperationError(null);
  }, []);

  function openCreate(parentId: number | null = null) {
    setCreateDraft(emptyDraft(parentId));
    setCreateError(null);
    setCreating(true);
  }

  async function handleCreate() {
    if (!createDraft.name.trim() || savingCreate) return;
    setSavingCreate(true);
    setCreateError(null);

    try {
      const created = await createSeries({
        name: createDraft.name.trim(),
        author: createDraft.author.trim() || null,
        description: createDraft.description.trim() || null,
        parent_id: createDraft.parentId,
      });
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

  function beginEdit() {
    if (!selected) return;
    setEditDraft({
      name: selected.name,
      author: selected.author ?? "",
      description: selected.description ?? "",
      parentId: selected.parent_id,
    });
    setEditError(null);
    setOperationError(null);
    setEditing(true);
  }

  async function handleUpdate() {
    if (!selected || !editDraft.name.trim() || savingEdit) return;
    setSavingEdit(true);
    setEditError(null);

    try {
      await updateSeries(selected.id, {
        name: editDraft.name.trim(),
        author: editDraft.author.trim() || null,
        description: editDraft.description.trim() || null,
        parent_id: editDraft.parentId,
      });
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

  const editParentOptions = useMemo(() => {
    if (!selected) return [];
    const excluded = descendantIds(selected);
    excluded.add(selected.id);
    return seriesOptions(tree, excluded);
  }, [selected, tree]);

  const selectedParent = selected?.parent_id
    ? flatSeries.find((series) => series.id === selected.parent_id) ?? null
    : null;

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
          <ActionButton variant="addPrimary" className="mt-5" onClick={() => openCreate()}>
            <Plus size={17} aria-hidden="true" /> Create Series
          </ActionButton>
        </div>
        <CreateSeriesDialog
          open={creating}
          draft={createDraft}
          error={createError}
          saving={savingCreate}
          options={seriesOptions(tree)}
          onChange={setCreateDraft}
          onClose={() => !savingCreate && setCreating(false)}
          onSubmit={handleCreate}
        />
      </>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-surface-muted/30">
        <div className="flex flex-col gap-3 border-b border-border bg-surface/60 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div>
            <h3 className="font-semibold text-text-primary">Series hierarchy</h3>
            <p className="mt-0.5 text-xs text-text-muted">Select a Series to view or edit its details.</p>
          </div>
          <ActionButton variant="addPrimary" onClick={() => openCreate()}>
            <Plus size={16} aria-hidden="true" /> Create Series
          </ActionButton>
        </div>

        <div className="grid min-w-0 lg:grid-cols-[minmax(0,3fr)_minmax(300px,2fr)]">
          <div className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
            <div className="max-h-[42vh] overflow-y-auto p-2 lg:hidden">
              <MobileSeriesTree nodes={tree} selectedId={selectedId} onSelect={(id) => selectSeries(id)} />
            </div>
            <div className="hidden h-[64vh] lg:flex">
              <SeriesTreeFlow series={tree} selectedId={selectedId} onSelect={selectSeries} />
            </div>
          </div>

          <aside className="min-w-0 bg-surface p-4 sm:p-5" aria-label="Selected Series details">
            {!selected ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center text-text-muted">
                <GitBranch size={26} aria-hidden="true" />
                <p className="mt-3 text-sm">Select a Series to see its details.</p>
              </div>
            ) : editing ? (
              <div>
                <h3 className="mb-4 text-lg font-semibold">Edit Series</h3>
                <SeriesForm
                  draft={editDraft}
                  parentOptions={editParentOptions}
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
            ) : (
              <div className="space-y-5">
                {operationError && (
                  <div role="alert" className="rounded-xl border border-danger/30 bg-danger-muted/35 px-3 py-2 text-sm text-danger">
                    {operationError}
                  </div>
                )}

                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex h-40 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface-muted text-text-muted">
                    {selected.cover_url ? (
                      <img src={selected.cover_url} alt={`${selected.name} cover`} className="h-full w-full object-cover" />
                    ) : (
                      <div className="px-2 text-center">
                        <BookOpen className="mx-auto" size={25} aria-hidden="true" />
                        <span className="mt-2 block text-xs">No cover</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="break-words text-xl font-semibold text-text-primary">{selected.name}</h3>
                    <p className="mt-1 break-words text-sm text-text-secondary">{selected.author || "No author set"}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <ActionButton variant="primary" onClick={beginEdit}>Edit Series</ActionButton>
                      <ActionButton variant="secondary" onClick={() => openCreate(selected.id)}>
                        <Plus size={15} aria-hidden="true" /> Add Subseries
                      </ActionButton>
                    </div>
                  </div>
                </div>

                <dl className="grid gap-4 border-t border-border pt-4 text-sm">
                  <div>
                    <dt className="text-text-muted">Parent Series</dt>
                    <dd className="mt-1 break-words text-text-primary">{selectedParent?.name ?? "None (root Series)"}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Subseries</dt>
                    <dd className="mt-1 text-text-primary">{selected.children.length}</dd>
                  </div>
                  <div>
                    <dt className="text-text-muted">Description</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words leading-relaxed text-text-primary">
                      {selected.description || "No description added."}
                    </dd>
                  </div>
                </dl>

                <div className="border-t border-border pt-5">
                  <ActionButton variant="danger" onClick={() => setConfirmingDelete(true)}>
                    Delete Series
                  </ActionButton>
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    Series with subseries, book memberships, or ordering records cannot be deleted.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </div>

        {selected && !editing && (
          <div className="bg-surface px-4 pb-5 sm:px-5">
            <SeriesBooksSection
              seriesId={selected.id}
              seriesName={selected.name}
              onSelectSeries={(id) => selectSeries(id)}
            />
          </div>
        )}
      </div>

      <CreateSeriesDialog
        open={creating}
        draft={createDraft}
        error={createError}
        saving={savingCreate}
        options={seriesOptions(tree)}
        onChange={setCreateDraft}
        onClose={() => !savingCreate && setCreating(false)}
        onSubmit={handleCreate}
      />

      <ConfirmDeleteModal
        open={confirmingDelete}
        title="Delete Series?"
        message={`Delete “${selected?.name ?? "this Series"}”? This cannot be undone.`}
        confirmText={deleting ? "Deleting…" : "Delete Series"}
        onConfirm={handleDelete}
        onCancel={() => !deleting && setConfirmingDelete(false)}
      />
    </>
  );
}

type CreateDialogProps = {
  open: boolean;
  draft: SeriesDraft;
  error: string | null;
  saving: boolean;
  options: ReturnType<typeof seriesOptions>;
  onChange: (draft: SeriesDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function CreateSeriesDialog({ open, draft, error, saving, options, onChange, onClose, onSubmit }: CreateDialogProps) {
  return (
    <Dialog open={open} title={draft.parentId === null ? "Create Series" : "Add Subseries"} onClose={onClose} className="max-w-xl">
      <div className="p-4 sm:p-5">
        <SeriesForm
          draft={draft}
          parentOptions={options}
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
