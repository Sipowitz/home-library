import type { ReturnPlacementPreview } from "../../api/books";
import { ActionButton } from "../ui/ActionButton";
import { Dialog } from "../ui/Dialog";
import { PlacementBookCard } from "./PlacementBookCard";

export function ReturnToShelfDialog({ preview, confirming, onClose, onConfirm }: {
  preview: ReturnPlacementPreview | null; confirming: boolean; onClose: () => void; onConfirm: () => void;
}) {
  return <Dialog open={preview !== null} title="Return to Shelf" onClose={() => { if (!confirming) onClose(); }} className="max-w-4xl" layerClassName="z-[100]">
    {preview && <div className="space-y-4 p-5">
      <p className="text-sm text-text-secondary">Preview of the book's current home shelf.</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {preview.before.map((book) => <PlacementBookCard key={book.id} book={book} />)}
        <PlacementBookCard book={preview.book} label="THIS BOOK" />
        {preview.after.map((book) => <PlacementBookCard key={book.id} book={book} />)}
      </div>
      <div className="flex justify-end gap-2"><ActionButton onClick={onClose} disabled={confirming}>Cancel</ActionButton><ActionButton variant="primary" onClick={onConfirm} disabled={confirming}>{confirming ? "Returning…" : "Confirm Return"}</ActionButton></div>
    </div>}
  </Dialog>;
}
