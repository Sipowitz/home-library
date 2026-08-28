import { useState } from "react";
import { Camera, Loader2, Search } from "lucide-react";
import axios from "axios";
import { checkLibrary, previewBookByISBN, type LibraryCheckResponse } from "../../api/books";
import type { Book, BookDraft } from "../../types/book";
import { useISBNScanner } from "../../hooks/useISBNScanner";
import { Dialog } from "../ui/Dialog";
import { ActionButton } from "../ui/ActionButton";
import { ISBNScannerModal } from "./ISBNScannerModal";

type Props = {
  open: boolean;
  onClose: () => void;
  onViewBook: (book: Book) => void;
  onAddBook: (draft: BookDraft) => void;
};

const emptyResult: LibraryCheckResponse = { exact_matches: [], likely_matches: [], possible_matches: [] };

export function CheckLibraryDialog({ open, onClose, onViewBook, onAddBook }: Props) {
  const [isbn, setIsbn] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [result, setResult] = useState<LibraryCheckResponse | null>(null);
  const [identified, setIdentified] = useState<BookDraft>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scannerRegionId = "check-library-isbn-scanner";

  async function runCheck(nextISBN = isbn) {
    const cleanISBN = nextISBN.trim();
    const cleanTitle = title.trim();
    const cleanAuthor = author.trim();
    if (!cleanISBN && !cleanTitle && !cleanAuthor) {
      setError("Enter an ISBN, title, or author.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    let resolved: BookDraft = { isbn: cleanISBN || undefined, title: cleanTitle || undefined, author: cleanAuthor || undefined };
    if (cleanISBN) {
      try {
        const preview = await previewBookByISBN(cleanISBN);
        resolved = { ...preview, ...resolved, title: cleanTitle || preview.title, author: cleanAuthor || preview.author };
        if (!cleanTitle && preview.title) setTitle(preview.title);
        if (!cleanAuthor && preview.author) setAuthor(preview.author);
      } catch {
        // Ownership checking still works when no provider can identify the ISBN.
      }
    }
    try {
      const data = await checkLibrary({ isbn: cleanISBN || undefined, title: resolved.title, author: resolved.author });
      setIdentified(resolved);
      setResult(data);
    } catch (err: unknown) {
      setResult(emptyResult);
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      setError(typeof detail === "string" ? detail : "Library check failed.");
    } finally {
      setLoading(false);
    }
  }

  const scanner = useISBNScanner({
    scannerRegionId,
    onScan: (value) => {
      setIsbn(value);
      void runCheck(value);
    },
    onError: () => setError("Unable to access camera."),
  });

  function close() {
    void scanner.stopScanner();
    setIsbn(""); setTitle(""); setAuthor(""); setResult(null); setIdentified({}); setError(null);
    onClose();
  }

  const groups = result ? [
    { key: "exact", heading: "Exact ISBN owned", message: "You already own this ISBN.", matches: result.exact_matches, tone: "border-green-500/45 bg-green-500/10 text-green-200" },
    { key: "likely", heading: "Likely same book / different edition", message: "You may already own another edition with the same title and author.", matches: result.likely_matches, tone: "border-amber-500/45 bg-amber-500/10 text-amber-100" },
    { key: "possible", heading: "Possible match", message: "These title or author matches may be related.", matches: result.possible_matches, tone: "border-blue-500/40 bg-blue-500/10 text-blue-100" },
  ].filter((group) => group.matches.length) : [];

  return (
    <>
      <Dialog open={open} title="Check Library" onClose={close} className="max-w-3xl">
        <div className="space-y-5 p-4 sm:p-5">
          <p className="text-sm text-gray-400">Scan or enter an ISBN, or search by title, author, or both.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="text-xs text-gray-400">ISBN</span><div className="mt-1 flex gap-2"><input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="Scan or enter ISBN..." className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 outline-none focus:border-blue-500" />{typeof navigator !== "undefined" && !!navigator.mediaDevices && <ActionButton variant="secondary" onClick={() => scanner.setScannerOpen(true)} aria-label="Scan ISBN with camera"><Camera size={18} /><span>Scan</span></ActionButton>}</div></label>
            <label><span className="text-xs text-gray-400">Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Book title" className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 outline-none focus:border-blue-500" /></label>
            <label><span className="text-xs text-gray-400">Author</span><input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Author name" className="mt-1 w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 outline-none focus:border-blue-500" /></label>
          </div>
          <div className="flex justify-end"><ActionButton variant="primary" onClick={() => void runCheck()} disabled={loading}>{loading ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}Check Library</ActionButton></div>
          {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
          <div aria-live="polite" className="space-y-5">
            {groups.map((group) => <section key={group.key} className="space-y-3" aria-labelledby={`check-${group.key}`}><div className={`rounded-xl border p-3 ${group.tone}`}><h3 id={`check-${group.key}`} className="font-semibold">{group.heading}</h3><p className="mt-1 text-sm opacity-90">{group.message}</p></div><div className="space-y-2">{group.matches.map(({ book }) => <article key={`${group.key}-${book.id}`} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-900 p-3">{book.cover_url ? <img src={book.cover_url} alt="" className="h-20 w-14 shrink-0 rounded object-cover" /> : <div className="h-20 w-14 shrink-0 rounded bg-gray-800" aria-hidden="true" />}<div className="min-w-0 flex-1"><h4 className="font-medium">{book.title}</h4><p className="text-sm text-gray-400">{book.author}</p>{book.isbn && <p className="mt-1 text-xs text-gray-500">Your ISBN: {book.isbn}</p>}{isbn && book.isbn !== result?.normalized_isbn && <p className="text-xs text-gray-500">Checked ISBN: {result?.normalized_isbn || isbn}</p>}</div><ActionButton variant="tertiary" size="sm" onClick={() => onViewBook(book)}>View Book</ActionButton></article>)}</div></section>)}
            {result && groups.length === 0 && <div className="rounded-xl border border-gray-700 bg-gray-900 p-4"><h3 className="font-semibold">No likely match</h3><p className="mt-1 text-sm text-gray-400">No meaningful ownership match was found in your library.</p><ActionButton variant="addPrimary" className="mt-4" onClick={() => onAddBook(identified)}>+ Add Book</ActionButton></div>}
          </div>
        </div>
      </Dialog>
      <ISBNScannerModal open={scanner.scannerOpen} scannerRegionId={scannerRegionId} torchSupported={scanner.torchSupported} torchOn={scanner.torchOn} onToggleTorch={scanner.toggleTorch} onClose={scanner.stopScanner} />
    </>
  );
}
