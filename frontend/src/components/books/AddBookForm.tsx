import { useState } from "react";

import { ISBNScannerModal } from "./ISBNScannerModal";
import { ISBNInputRow } from "./ISBNInputRow";
import { BookPreview } from "./BookPreview";
import { BookFields } from "./BookFields";

import { useISBNScanner } from "../../hooks/useISBNScanner";

import type { BookDraft } from "../../types/book";
import { ActionButton } from "../ui/ActionButton";

type Props = {
  newBook: BookDraft;
  setNewBook: (book: BookDraft | ((prev: any) => BookDraft)) => void;
  onSearch: (isbn?: string) => void;
  onAdd: (allowDuplicate?: boolean) => Promise<unknown>;
  onAddReview: (allowDuplicate?: boolean) => Promise<unknown>;
  canAddReview: boolean;
  onReset: () => void;
  onISBNChange: (value: string) => void;
  isFetching: boolean;
  embedded?: boolean;
};

export function AddBookForm({
  newBook,
  setNewBook,
  onSearch,
  onAdd,
  onAddReview,
  canAddReview,
  onReset,
  onISBNChange,
  isFetching,
  embedded = false,
}: Props) {
  const [warning, setWarning] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ title?: string; author?: string; isbn?: string; action: "add" | "review" } | null>(null);

  const scannerRegionId = "isbn-scanner";

  function errorMessage(err: any) {
    const response = err?.response?.data;
    const detail = response?.detail ?? response?.message;
    if (response?.code === "DUPLICATE_BOOK") {
      const book = response.book;
      const identity = book?.title ? ` (${book.title}${book.author ? ` — ${book.author}` : ""})` : "";
      return `${response.message || "This book is already in your library."}${identity}`;
    }
    if (typeof detail === "string") return detail;
    if (detail?.code === "DUPLICATE_BOOK") {
      const book = detail.book;
      const identity = book?.title ? ` (${book.title}${book.author ? ` — ${book.author}` : ""})` : "";
      return `${detail.message || "This book is already in your library."}${identity}`;
    }
    if (Array.isArray(detail)) {
      return detail.map((item) => item?.msg).filter(Boolean).join("; ") || "Failed to add book";
    }
    return err?.message || "Failed to add book";
  }

  // -------------------
  // 📷 SCANNER HOOK
  // -------------------
  const {
    scannerOpen,
    setScannerOpen,
    torchOn,
    torchSupported,
    toggleTorch,
    stopScanner,
  } = useISBNScanner({
    scannerRegionId,

    onScan: (isbn) => {
      setWarning(null);
      onSearch(isbn);
    },

    onError: () => {
      setWarning("Unable to access camera");
    },
  });

  // -------------------
  // ➕ ADD BOOK
  // -------------------
  function duplicateDetails(err: any) {
    const data = err?.response?.data;
    if (data?.code === "DUPLICATE_BOOK") return data.book || {};
    return null;
  }

  async function handleAdd() {
    setWarning(null);

    try {
      await onAdd(false);
    } catch (err: any) {
      const details = duplicateDetails(err);
      if (details) {
        setDuplicate({ ...details, action: "add" });
        return;
      }
      setWarning(errorMessage(err));
    }
  }

  async function handleAddReview() {
    setWarning(null);
    try {
      await onAddReview(false);
    } catch (err: any) {
      const details = duplicateDetails(err);
      if (details) {
        setDuplicate({ ...details, action: "review" });
        return;
      }
      setWarning(errorMessage(err));
    }
  }

  async function handleDuplicateConfirm() {
    if (!duplicate) return;
    try {
      if (duplicate.action === "add") await onAdd(true);
      else await onAddReview(true);
      setDuplicate(null);
    } catch (err: any) {
      setWarning(errorMessage(err));
      setDuplicate(null);
    }
  }

  async function handleStartOver() {
    await stopScanner();
    setWarning(null);
    onReset();
  }

  return (
    <>
      <div className={embedded ? "" : "bg-gray-900/80 backdrop-blur border border-gray-800 p-5 rounded-2xl shadow-xl"}>
        {/* HEADER */}
        {!embedded && <h2 className="text-lg font-semibold mb-4 tracking-wide">Add Book</h2>}

        <ISBNInputRow
          isbn={newBook.isbn || ""}
          isFetching={isFetching}
          onChange={onISBNChange}
          onSearch={() => onSearch()}
          onOpenScanner={() => setScannerOpen(true)}
        />

        {/* ⚠️ WARNING */}
        {warning && (
          <div className="bg-yellow-500/90 text-black p-2 rounded-lg mb-4 text-sm">
            {warning}
          </div>
        )}

        <BookPreview coverUrl={newBook.cover_url} />

        <BookFields
          title={newBook.title || ""}
          author={newBook.author || ""}
          onTitleChange={(value) =>
            setNewBook({
              ...newBook,
              title: value,
            })
          }
          onAuthorChange={(value) =>
            setNewBook({
              ...newBook,
              author: value,
            })
          }
        />

        {/* ACTIONS */}
        <div className="mt-5 flex gap-2">
          <ActionButton
            type="button"
            variant="tertiary"
            onClick={handleStartOver}
          >
            Start Over
          </ActionButton>
          <ActionButton
            type="button"
            variant="addPrimary"
            onClick={handleAdd}
            className="flex-1"
          >
            Add to Library
          </ActionButton>
          <ActionButton
            type="button"
            variant="secondary"
            onClick={handleAddReview}
            disabled={!canAddReview}
          >
            Add &amp; Review
          </ActionButton>
        </div>
      </div>

      <ISBNScannerModal
        open={scannerOpen}
        scannerRegionId={scannerRegionId}
        torchSupported={torchSupported}
        torchOn={torchOn}
        onToggleTorch={toggleTorch}
        onClose={stopScanner}
      />
      {duplicate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="duplicate-book-title">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-gray-900 p-5 shadow-2xl">
            <h2 id="duplicate-book-title" className="text-lg font-semibold text-white">This ISBN is already in your library.</h2>
            <div className="mt-3 space-y-1 text-sm text-gray-300">
              {duplicate.title && <p>{duplicate.title}</p>}
              {duplicate.author && <p>{duplicate.author}</p>}
              {duplicate.isbn && <p className="text-gray-500">ISBN: {duplicate.isbn}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <ActionButton variant="tertiary" onClick={() => setDuplicate(null)}>Cancel</ActionButton>
              <ActionButton variant="primary" onClick={handleDuplicateConfirm}>Add Another Copy</ActionButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
