import { Pencil, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useLocations } from "../../context/LocationContext";
import { useCategories } from "../../context/CategoryContext";

import { BookView } from "./BookView";
import { BookEdit } from "./BookEdit";
import { DeleteModal } from "./DeleteModal";

import type { Book } from "../../types/book";

type Props = {
  book: Book | null;
  editing: boolean;
  editData: Book | null;

  setEditing: (value: boolean) => void;

  setEditData: (book: Book) => void;

  onClose: () => void;

  onSave: () => void;

  onDelete: (id: number) => void;

  onBookUpdated: (book: Book) => void;
};

export function BookPanel({
  book,
  editing,
  editData,
  setEditing,
  setEditData,
  onClose,
  onSave,
  onDelete,
  onBookUpdated,
}: Props) {
  const { locations } = useLocations();

  const { categories } = useCategories();

  const [confirmDelete, setConfirmDelete] = useState(false);

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
          ${editing ? "w-[1180px]" : "w-[900px]"}
          max-w-[calc(100vw-2rem)]

          rounded-3xl
          border border-white/10

          bg-[#07111f]/95

          shadow-[0_0_80px_rgba(0,0,0,0.45)]

          backdrop-blur-xl

          flex flex-col
          overflow-hidden
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* CONTROLS */}

        <div className="absolute right-3 top-3 z-[70] flex items-center gap-2">
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
            onClick={onClose}
            aria-label="Close book details"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-black/40 text-gray-200 backdrop-blur-md transition hover:bg-black/50 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENT */}

        <div
          className={`
            flex-1 overflow-y-auto
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
              onCancel={handleCancel}
              onDelete={() => setConfirmDelete(true)}
              onBookUpdated={onBookUpdated}
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
