import { useState } from "react";

import { ISBNScannerModal } from "./ISBNScannerModal";
import { ISBNInputRow } from "./ISBNInputRow";
import { BookPreview } from "./BookPreview";
import { BookFields } from "./BookFields";

import { useISBNScanner } from "../../hooks/useISBNScanner";

import type { BookDraft } from "../../types/book";

type Props = {
  newBook: BookDraft;
  setNewBook: (book: BookDraft | ((prev: any) => BookDraft)) => void;
  onSearch: (isbn?: string) => void;
  onAdd: () => void;
  onReset: () => void;
  onISBNChange: (value: string) => void;
  isFetching: boolean;
};

export function AddBookForm({
  newBook,
  setNewBook,
  onSearch,
  onAdd,
  onReset,
  onISBNChange,
  isFetching,
}: Props) {
  const [warning, setWarning] = useState<string | null>(null);

  const scannerRegionId = "isbn-scanner";

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
  async function handleAdd() {
    setWarning(null);

    try {
      await onAdd();
    } catch (err: any) {
      setWarning(err?.message || "Failed to add book");
    }
  }

  async function handleStartOver() {
    await stopScanner();
    setWarning(null);
    onReset();
  }

  return (
    <>
      <div className="bg-gray-900/80 backdrop-blur border border-gray-800 p-5 rounded-2xl shadow-xl">
        {/* HEADER */}
        <h2 className="text-lg font-semibold mb-4 tracking-wide">Add Book</h2>

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
          <button
            type="button"
            onClick={handleStartOver}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white"
          >
            Start Over
          </button>
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 rounded-lg bg-green-600 py-2 font-medium transition hover:bg-green-700"
          >
            Add to Library
          </button>
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
    </>
  );
}
