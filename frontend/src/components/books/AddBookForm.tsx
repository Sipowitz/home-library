/* eslint-disable @typescript-eslint/no-explicit-any -- Existing workflow accepts API error and updater shapes from legacy callers. */
import { useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";

import { ISBNScannerModal } from "./ISBNScannerModal";
import { ISBNInputRow } from "./ISBNInputRow";
import { BookPreview } from "./BookPreview";
import { BookFields } from "./BookFields";
import { BookSearchResults } from "./BookSearchResults";

import { useISBNScanner } from "../../hooks/useISBNScanner";

import type { BookDraft } from "../../types/book";
import { searchCatalogBooks, type CatalogSearchCandidate } from "../../api/books";
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
  onCatalogCandidateSelected?: (candidate: BookDraft) => void;
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
  onCatalogCandidateSelected,
  isFetching,
  embedded = false,
}: Props) {
  const [warning, setWarning] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{ title?: string; author?: string; isbn?: string; action: "add" | "review" } | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogSearchCandidate[] | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [visibleCatalogItems, setVisibleCatalogItems] = useState(10);
  const [catalogSelected, setCatalogSelected] = useState(false);
  const catalogRequestRef = useRef(0);

  const scannerRegionId = "isbn-scanner";
  const isbnMode = Boolean(newBook.isbn?.trim());
  const canSearch = isbnMode || Boolean(newBook.title?.trim());

  function clearCatalogSearch() {
    catalogRequestRef.current += 1;
    setCatalogItems(null);
    setCatalogError(null);
    setCatalogSearching(false);
    setVisibleCatalogItems(10);
    setCatalogSelected(false);
  }

  function handleISBNChange(value: string) {
    clearCatalogSearch();
    onISBNChange(value);
    if (value.trim()) setNewBook({ isbn: value });
  }

  function handleCatalogFieldChange(field: "title" | "author", value: string) {
    clearCatalogSearch();
    onISBNChange("");
    setNewBook((previous: BookDraft) => ({
      ...previous,
      isbn: "",
      [field]: value,
    }));
  }

  async function handleSearch() {
    if (isbnMode) {
      clearCatalogSearch();
      onSearch();
      return;
    }
    const title = newBook.title?.trim();
    if (!title) return;

    const requestId = ++catalogRequestRef.current;
    setCatalogItems(null);
    setCatalogError(null);
    setCatalogSelected(false);
    setVisibleCatalogItems(10);
    setCatalogSearching(true);
    try {
      const items = await searchCatalogBooks(title, newBook.author?.trim());
      if (requestId !== catalogRequestRef.current) return;
      setCatalogItems(items);
    } catch (error) {
      if (requestId !== catalogRequestRef.current) return;
      console.error("Catalog search failed", error);
      setCatalogError("Catalog search could not be completed. Please try again.");
    } finally {
      if (requestId === catalogRequestRef.current) setCatalogSearching(false);
    }
  }

  function handleCatalogSelection(candidate: CatalogSearchCandidate) {
    clearCatalogSearch();
    setCatalogSelected(true);
    onCatalogCandidateSelected?.({
      title: candidate.title,
      author: candidate.author ?? "",
      subtitle: candidate.subtitle ?? undefined,
      publisher: candidate.publisher ?? undefined,
      year: candidate.year ?? undefined,
      isbn: candidate.isbn ?? "",
      cover_url: candidate.cover_url ?? "",
    });
  }

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
      clearCatalogSearch();
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
      <div className={embedded ? "" : "rounded-2xl border border-border bg-surface/80 p-5 shadow-xl backdrop-blur"}>
        {/* HEADER */}
        {!embedded && <h2 className="text-lg font-semibold mb-4 tracking-wide">Add Book</h2>}

        <ISBNInputRow
          isbn={newBook.isbn || ""}
          onChange={handleISBNChange}
          onOpenScanner={() => setScannerOpen(true)}
        />

        {/* ⚠️ WARNING */}
        {warning && (
          <div className="mb-4 rounded-lg border border-warning/25 bg-warning-muted p-2 text-sm text-warning">
            {warning}
          </div>
        )}

        <BookPreview coverUrl={newBook.cover_url} />

        <BookFields
          title={newBook.title || ""}
          author={newBook.author || ""}
          onTitleChange={(value) => handleCatalogFieldChange("title", value)}
          onAuthorChange={(value) => handleCatalogFieldChange("author", value)}
          disabled={isbnMode}
        />

        <ActionButton
          type="button"
          variant="primary"
          onClick={() => void handleSearch()}
          disabled={!canSearch || isFetching || catalogSearching}
          className="mt-3 w-full"
        >
          {isFetching || catalogSearching ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          Search
        </ActionButton>

        {catalogError && <p className="mt-3 text-sm text-warning">{catalogError}</p>}
        {catalogItems?.length === 0 && <p className="mt-3 text-sm text-text-muted">No catalog results found.</p>}
        {catalogItems && catalogItems.length > 0 && (
          <BookSearchResults
            items={catalogItems}
            visibleCount={visibleCatalogItems}
            onSelect={handleCatalogSelection}
            onShowMore={() => setVisibleCatalogItems((count) => Math.min(count + 10, catalogItems.length))}
          />
        )}
        {catalogSelected && <p className="mt-3 text-sm text-text-muted">Catalog result selected. Review the details, then add it to your library.</p>}

        {/* ACTIONS */}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <ActionButton
            type="button"
            variant="tertiary"
            onClick={handleStartOver}
            className="w-full sm:w-auto"
          >
            Start Over
          </ActionButton>
          <ActionButton
            type="button"
            variant="addPrimary"
            onClick={handleAdd}
            className="w-full sm:flex-1"
          >
            Add to Library
          </ActionButton>
          <ActionButton
            type="button"
            variant="secondary"
            onClick={handleAddReview}
            disabled={!canAddReview}
            className="w-full sm:w-auto"
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
          <div className="w-full max-w-md rounded-xl border border-border-strong bg-surface-raised p-5 text-text-primary shadow-2xl">
            <h2 id="duplicate-book-title" className="text-lg font-semibold">This ISBN is already in your library.</h2>
            <div className="mt-3 space-y-1 text-sm text-text-secondary">
              {duplicate.title && <p>{duplicate.title}</p>}
              {duplicate.author && <p>{duplicate.author}</p>}
              {duplicate.isbn && <p className="text-text-muted">ISBN: {duplicate.isbn}</p>}
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
