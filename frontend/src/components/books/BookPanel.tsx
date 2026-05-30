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
        className="
          fixed top-4 right-4 z-50

          h-[calc(100vh-2rem)]
          w-[900px]
          max-w-[calc(100vw-2rem)]

          rounded-3xl
          border border-white/10

          bg-[#07111f]/95

          shadow-[0_0_80px_rgba(0,0,0,0.45)]

          backdrop-blur-xl

          flex flex-col
          overflow-hidden
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}

        <div
          className="
            flex items-center justify-between

            px-6 py-5

            border-b border-white/5
          "
        >
          <div />

          <div className="flex items-center gap-2">
            {!editing && (
              <button
                onClick={handleEdit}
                className="
                  group

                  flex items-center justify-center

                  w-10 h-10

                  rounded-xl

                  border border-white/10

                  bg-white/5

                  text-gray-300

                  transition-all duration-200

                  hover:bg-blue-500/10
                  hover:border-blue-400/30
                  hover:text-blue-300
                "
                title="Edit Book"
              >
                <Pencil
                  size={18}
                  className="
                    transition-transform
                    duration-200
                    group-hover:scale-110
                  "
                />
              </button>
            )}

            <button
              onClick={onClose}
              className="
                flex items-center justify-center

                w-10 h-10

                rounded-xl

                text-gray-400

                transition

                hover:bg-white/5
                hover:text-white
              "
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CONTENT */}

        <div
          className="
            flex-1
            overflow-y-auto

            px-6 py-6

            scrollbar-thin
            scrollbar-thumb-gray-700
            scrollbar-track-transparent
          "
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
