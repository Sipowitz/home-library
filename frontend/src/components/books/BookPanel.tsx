import { Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLocations } from "../../context/LocationContext";
import { useCategories } from "../../context/CategoryContext";

import { BookView, resolveCoverUrl } from "./BookView";
import { BookEdit } from "./BookEdit";
import { DeleteModal } from "./DeleteModal";

import type { Book } from "../../types/book";
import type { ReviewIntent } from "../../api/books";

type Props = {
  book: Book | null;
  editing: boolean;
  editData: Book | null;

  setEditing: (value: boolean) => void;

  setEditData: (book: Book) => void;

  onClose: () => void;

  onSave: (reviewIntent?: ReviewIntent) => void;

  onDelete: (id: number) => void;

};

export function BookPanel({
  book,
  editing,
  editData,
  setEditing,
  setEditData,
  onClose,
  onSave,
  onDelete
}: Props) {
  const { locations } = useLocations();

  const { categories } = useCategories();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [metadataComparisonOpen, setMetadataComparisonOpen] = useState(false);
  const [failedBackdropUrl, setFailedBackdropUrl] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setConfirmDelete(false);
  }, [book, editing]);

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

  if (!book) return null;

  return (
    <>
      {/* BACKDROP */}

      <div
        className="
          fixed inset-0 z-40
          bg-black/50
          backdrop-blur-sm
        "
        onClick={onClose}
      />

      {/* PANEL */}

      <div
        className={`
          fixed top-4 right-4 z-50

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
          {!editing && (
            <button
              type="button"
              onClick={handleEdit}
              aria-label="Edit book"
              title="Edit book"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/30 text-gray-200 backdrop-blur-md transition hover:bg-black/45 hover:text-white"
            >
              <Pencil size={19} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            onClick={editing ? handleCancel : onClose}
            aria-label="Close book details"
            className="ml-auto flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 sm:ml-0 text-gray-200 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        )}

        {/* CONTENT */}

        <div
          className={`
            relative z-20 flex-1 overflow-y-auto
            ${
              editing
                ? "px-5 pb-4 pt-14 sm:py-5 sm:pl-6 sm:pr-16"
                : "p-0"
            }
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
        onClose={() => setConfirmDelete(false)}
        onDelete={onDelete}
      />
    </>
  );
}
