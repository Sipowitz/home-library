import { X } from "lucide-react";
import { useLocations } from "../../context/LocationContext";
import { useEffect, useState, useRef } from "react";
import { fetchCategories } from "../../api/categories";
import type { Category } from "../../api/categories";

import { BookView } from "./BookView";
import { BookEdit } from "./BookEdit";
import { DeleteModal } from "./DeleteModal";

type Book = {
  id: number;
  title: string;
  author: string;
  year?: number;
  isbn?: string;
  description?: string;
  read?: boolean;
  read_at?: string | null;
  location_id?: number;
  cover_url?: string;
  categories?: { id: number; name: string }[];
  category_ids?: number[];
  date_added?: string;
};

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
  const flatLocations = flattenLocations(locations);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetchCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!editData) return;

    if (editData.category_ids?.length) {
      setSelectedCategories(editData.category_ids);
    } else if (editData.categories?.length) {
      setSelectedCategories(editData.categories.map((c) => c.id));
    } else {
      setSelectedCategories([]);
    }
  }, [editData]);

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
        className="fixed top-4 right-4 w-[95vw] sm:w-[600px] max-h-[95vh]
        bg-gray-900/95 backdrop-blur p-5 shadow-2xl rounded-2xl border border-gray-800
        z-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="mb-2">
          <X />
        </button>

        <div className="flex-1 overflow-y-auto pr-1">
          {!editing ? (
            <BookView book={book} locations={locations} />
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
        </div>

        {/* ACTIONS */}
        <div className="mt-4 space-y-2">
          {!editing ? (
            <>
              <button
                onClick={() => {
                  setEditing(true);
                  setEditData(book);
                }}
                className="bg-yellow-600 w-full py-2 rounded"
              >
                Edit
              </button>

              <button
                onClick={() => setConfirmDelete(true)}
                className="bg-red-600 w-full py-2 rounded"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onSave(selectedCategories)}
                className="bg-green-600 w-full py-2 rounded"
              >
                Save
              </button>

              <button
                onClick={() => setEditing(false)}
                className="bg-gray-600 w-full py-2 rounded"
              >
                Cancel
              </button>
            </>
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
