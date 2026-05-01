import { Loader2, Search, Camera } from "lucide-react";

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
      <label className="text-xs text-gray-400">ISBN</label>

      <div className="flex items-stretch gap-2 mt-1 min-w-0">
        <input
          placeholder="Scan or enter ISBN..."
          className="flex-1 min-w-0 p-2 bg-gray-800 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={isbn}
          onChange={(e) => onChange(e.target.value)}
        />

        {/* 📷 CAMERA BUTTON */}
        {typeof navigator !== "undefined" &&
          !!navigator.mediaDevices &&
          !!navigator.mediaDevices.getUserMedia && (
            <button
              onClick={onOpenScanner}
              className="shrink-0 px-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center justify-center transition"
            >
              <Camera size={16} />
            </button>
          )}

        {/* 🔍 SEARCH */}
        <button
          onClick={onSearch}
          className="shrink-0 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition"
        >
          {isFetching ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Search size={16} />
          )}
        </button>
      </div>
    </div>
  );
}
