import { Loader2, Search, Camera } from "lucide-react";
import { ActionButton } from "../ui/ActionButton";

type Props = {
  isbn: string;
  isFetching: boolean;
  onChange: (value: string) => void;
  onSearch: () => void;
  onOpenScanner: () => void;
};

export function ISBNInputRow({
  isbn,
  isFetching,
  onChange,
  onSearch,
  onOpenScanner,
}: Props) {
  return (
    <div className="mb-4">
      <label className="text-xs text-text-muted">ISBN</label>

      <div className="flex items-stretch gap-2 mt-1 min-w-0">
        <input
          placeholder="Scan or enter ISBN..."
          className="form-control min-w-0 flex-1 rounded-lg p-2"
          value={isbn}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* 📷 CAMERA BUTTON */}
        {typeof navigator !== "undefined" &&
          !!navigator.mediaDevices &&
          !!navigator.mediaDevices.getUserMedia && (
            <ActionButton
              variant="icon"
              size="icon"
              onClick={onOpenScanner}
              aria-label="Scan ISBN with camera"
            >
              <Camera size={16} />
            </ActionButton>
          )}

        {/* 🔍 SEARCH */}
        <ActionButton
          variant="primary"
          size="icon"
          onClick={onSearch}
          aria-label="Look up ISBN"
        >
          {isFetching ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Search size={16} />
          )}
        </ActionButton>
      </div>
    </div>
  );
}
