import { Pencil, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useLocations } from "../../context/LocationContext";
import { useCategories } from "../../context/CategoryContext";

import { BookView, resolveCoverUrl } from "./BookView";
import { BookEdit } from "./BookEdit";
import { DeleteModal } from "./DeleteModal";
import { ActionButton } from "../ui/ActionButton";
import { useOverlayScrollLock } from "../../hooks/useOverlayScrollLock";

import type { Book, BookCollectionPath } from "../../types/book";
import type { ReviewIntent } from "../../api/books";

type Props = {
  book: Book | null;
  openedInCollection: boolean;
  editing: boolean;
  editData: Book | null;

  setEditing: (value: boolean) => void;

  setEditData: (book: Book) => void;

  onClose: () => void;

  onSave: (reviewIntent?: ReviewIntent) => void;

  onDelete: (id: number) => Promise<void>;
  onTakeOut?: (id: number) => void;
  onReturnToShelf?: (id: number) => void;
  checkoutPending?: boolean;

};

export function BookPanel({
  book,
  openedInCollection,
  editing,
  editData,
  setEditing,
  setEditData,
  onClose,
  onSave,
  onDelete,
  onTakeOut,
  onReturnToShelf,
  checkoutPending = false,
}: Props) {
  useOverlayScrollLock(Boolean(book));
  const { locations } = useLocations();

  const { categories } = useCategories();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hasCollections, setHasCollections] = useState(false);
  const [metadataComparisonOpen, setMetadataComparisonOpen] = useState(false);
  const [failedBackdropUrl, setFailedBackdropUrl] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setConfirmDelete(false);
  }, [book, editing]);

  useEffect(() => {
    setHasCollections(false);
  }, [book?.id]);

  useEffect(() => {}, [book]);

  function handleEdit() {
    if (!book) return;

    setEditing(true);

    setEditData(book);
  }

  function handleComparisonClose() {
    setMetadataComparisonOpen(false);
  }

  function handleCancel() {
    if (!book?.id) {
      onClose();

      return;
    }

    setEditing(false);

    setEditData(book);
  }

  const handleCollectionPathsChange = useCallback((paths: BookCollectionPath[] | null) => {
    setHasCollections(Boolean(paths?.length));
  }, []);

  if (!book) return null;

  return (
    <>
      {/* BACKDROP */}

      <div
        className="
          fixed inset-0 z-[80]
          bg-black/50
          backdrop-blur-sm
        "
        onClick={onClose}
      />

      {/* PANEL */}

      <div
        className={`
          fixed top-4 right-4 z-[90]

          h-[calc(100vh-2rem)]
          w-[900px]
          max-w-[calc(100vw-2rem)]

          rounded-3xl
          border border-white/10


          shadow-[0_0_80px_rgba(0,0,0,0.45)]

          backdrop-blur-xl

          flex flex-col
          overflow-hidden
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {(() => {
          const resolvedCoverUrl = resolveCoverUrl(book.cover_url);
          const showBackdrop = Boolean(
            resolvedCoverUrl && failedBackdropUrl !== resolvedCoverUrl,
          );

          return (
            <>
              {showBackdrop && (
                <img
                  key={`backdrop-panel-${resolvedCoverUrl}`}
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
            </>
          );
        })()}

        {/* CONTROLS */}

        {!metadataComparisonOpen && (
        <div className="absolute inset-x-3 top-3 z-[70] flex items-center gap-2 sm:left-auto sm:right-3">
          {!editing && (book.is_checked_out
            ? <ActionButton type="button" size="sm" onClick={() => onReturnToShelf?.(book.id)} disabled={checkoutPending}>Return to Shelf</ActionButton>
            : <span className="flex flex-col items-start" title={book.location_id == null ? "Assign a location before taking this book out." : undefined}><ActionButton type="button" size="sm" onClick={() => onTakeOut?.(book.id)} disabled={checkoutPending || book.location_id == null}>Take Out</ActionButton>{book.location_id == null && <span className="max-w-44 text-[10px] text-white">Assign a location before taking this book out.</span>}</span>)}
          {!editing && (
            <ActionButton
              type="button"
              variant="icon"
              size="icon"
              onClick={handleEdit}
              aria-label="Edit book"
              title="Edit book"
            >
              <Pencil size={19} aria-hidden="true" />
            </ActionButton>
          )}
          <ActionButton
            type="button"
            variant="icon"
            size="icon"
            onClick={editing ? handleCancel : onClose}
            aria-label="Close book details"
            className="ml-auto sm:ml-0"
          >
            <X size={20} />
          </ActionButton>
        </div>

        )}

        {/* CONTENT */}

        <div
          className={`
            relative z-20 flex-1 overflow-y-auto
            p-0
            scrollbar-thin
            scrollbar-thumb-gray-700
            scrollbar-track-transparent
          `}
        >
          {!editing ? (
            <BookView
              book={book}
              locations={locations}
              categories={categories}
              onCollectionPathsChange={handleCollectionPathsChange}
            />
          ) : (
            <BookEdit
              editData={editData}
              setEditData={setEditData}
              categories={categories}
              locations={locations}
              textareaRef={textareaRef}
              onSave={onSave}
              onDelete={() => setConfirmDelete(true)}
              onComparisonClose={handleComparisonClose}
              onComparisonOpenChange={setMetadataComparisonOpen}
            />
          )}
        </div>
      </div>

      {/* DELETE MODAL */}

      <DeleteModal
        open={confirmDelete}
        book={book}
        hasCollections={hasCollections}
        openedInCollection={openedInCollection}
        onClose={() => setConfirmDelete(false)}
        onDelete={onDelete}
      />
    </>
  );
}
