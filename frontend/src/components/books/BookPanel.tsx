import { X } from "lucide-react";
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
  onSave: (category_ids: number[]) => void;
  onDelete: (id: number) => void;
};

function flattenLocations(nodes: any[], level = 0): any[] {
  let result: any[] = [];

  for (const node of nodes) {
    result.push({ ...node, level });

    if (node.children?.length) {
      result = result.concat(flattenLocations(node.children, level + 1));
    }
  }

  return result;
}

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

  const flatLocations = flattenLocations(locations);

  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // -------------------
  // 🏷️ INITIALISE CATEGORY STATE
  // -------------------

  useEffect(() => {
    if (!editData) return;

    setSelectedCategories(editData.category_ids ?? []);
  }, [editData]);

  // -------------------
  // ❌ CANCEL
  // -------------------

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
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* PANEL */}
      <div
        className="fixed top-2 right-2 left-2
        sm:left-auto sm:right-4
        sm:w-[720px] lg:w-[800px]
        max-h-[95vh]
        bg-gray-900/95 backdrop-blur
        p-5 shadow-2xl rounded-2xl border border-gray-800
        z-50 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between mb-3 pr-2">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X />
          </button>
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
              selectedCategories={selectedCategories}
              setSelectedCategories={setSelectedCategories}
              flatLocations={flatLocations}
              textareaRef={textareaRef}
            />
          )}

          {/* ACTIONS */}
          <div className="mt-5 space-y-2 pb-2">
            {!editing ? (
              <>
                <button
                  onClick={() => {
                    setEditing(true);
                    setEditData(book);
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 transition w-full py-2 rounded"
                >
                  Edit
                </button>

                <button
                  onClick={() => setConfirmDelete(true)}
                  className="bg-red-600 hover:bg-red-700 transition w-full py-2 rounded"
                >
                  Delete
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onSave(selectedCategories)}
                  className="bg-green-600 hover:bg-green-700 transition w-full py-2 rounded"
                >
                  Save
                </button>

                <button
                  onClick={handleCancel}
                  className="bg-gray-600 hover:bg-gray-500 transition w-full py-2 rounded"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
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
