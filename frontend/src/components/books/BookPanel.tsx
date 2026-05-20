import { Pencil, Trash2, X } from "lucide-react";
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
}: Props) {
  const { locations } = useLocations();

  const { categories } = useCategories();

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
  }, [book, editing]);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
  }

  if (!book) return null;

  return (
    <>
      {/* BACKDROP */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* PANEL */}
      <div
        className="fixed top-2 right-2 left-2
        sm:left-auto sm:right-4
        sm:w-[720px] lg:w-[800px]
        max-h-[95vh]
        overflow-hidden
        rounded-2xl border border-gray-800
        bg-gray-900/95
        p-5
        shadow-2xl
        backdrop-blur
        z-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="mb-3 flex items-center justify-between pr-2">
          <div />

          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={handleEdit}
                className="group flex h-10 w-10 items-center justify-center
                rounded-xl border border-white/10
                bg-white/5 text-gray-300
                backdrop-blur-md
                transition-all duration-200
                hover:border-yellow-500/30
                hover:bg-yellow-500/10
                hover:text-yellow-300"
                aria-label="Edit book"
                title="Edit book"
              >
                <Pencil
                  size={18}
                  className="transition-transform duration-200 group-hover:scale-110"
                />
              </button>
            )}

            <button
              onClick={onClose}
              className="text-gray-400 transition hover:text-white"
              aria-label="Close panel"
            >
              <X />
            </button>
          </div>
        </div>

        {/* CONTENT */}
        <div
          className="flex-1 overflow-y-auto pr-3 min-h-0
          scrollbar-thin
          scrollbar-thumb-gray-700
          scrollbar-track-transparent"
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
            />
          )}

          {/* ACTIONS */}
          {editing && (
            <div className="mt-6 space-y-3 border-t border-gray-800 pt-4 pb-2">
              <button
                onClick={onSave}
                className="w-full rounded-xl bg-green-600 py-2.5 font-medium
                transition hover:bg-green-700"
              >
                Save
              </button>

              <button
                onClick={handleCancel}
                className="w-full rounded-xl bg-gray-700 py-2.5 font-medium
                transition hover:bg-gray-600"
              >
                Cancel
              </button>

              <div className="pt-2">
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex w-full items-center justify-center gap-2
                  rounded-xl border border-red-500/30
                  bg-red-500/10 py-2.5 font-medium text-red-300
                  transition-all duration-200
                  hover:border-red-500/50
                  hover:bg-red-500/20
                  hover:text-red-200"
                >
                  <Trash2 size={16} />
                  Delete Book
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DeleteModal
        open={confirmDelete}
        book={book}
        onClose={() => setConfirmDelete(false)}
        onDelete={onDelete}
      />
    </>
  );
}
