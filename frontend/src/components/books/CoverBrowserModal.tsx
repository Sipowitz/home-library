import { useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { refreshCovers, uploadCover } from "../../api/books";
import type { CoverCandidate, CoverRefreshResponse } from "../../api/books";
import toast from "react-hot-toast";

const MAX_COVER_UPLOAD_BYTES = 15 * 1024 * 1024;

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  covers: CoverCandidate[];
  bookId?: number;
  onSelectCover?: (cover: CoverCandidate) => void;
  onCoverUploaded?: (cover: CoverCandidate) => void;
  onCoversRefreshed?: (response: CoverRefreshResponse) => void;
  onMarkReviewed?: () => void;
  onRefreshStarted?: () => void;
  selectedCoverUrl?: string;
};

function providerLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function CoverBrowserModal({
  open, onClose, title, covers, bookId, onSelectCover, onCoverUploaded,
  onCoversRefreshed, onMarkReviewed, onRefreshStarted, selectedCoverUrl,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleUpload(file: File) {
    if (!bookId) return;
    if (file.size > MAX_COVER_UPLOAD_BYTES) {
      toast.error("Cover images must be 15 MiB or smaller");
      return;
    }
    try {
      const candidate = await uploadCover(bookId, file);
      onCoverUploaded?.(candidate);
    } catch {
      toast.error("Cover upload failed. Use a valid JPEG, PNG or WebP image.");
    }
  }

  async function handleRefresh() {
    if (!bookId || isRefreshing) return;
    onRefreshStarted?.();
    setIsRefreshing(true);
    try {
      const response = await refreshCovers(bookId);
      onCoversRefreshed?.(response);
      const failed = response.provider_results.filter((result) => !result.success);
      const successful = response.provider_results.length - failed.length;
      if (failed.length === 0) {
        toast.success(`Covers refreshed from ${successful} provider${successful === 1 ? "" : "s"}`);
      } else if (successful === 0) {
        toast.error("Cover refresh failed for all providers; previous choices were retained");
      } else {
        toast(`Refreshed covers from ${successful} provider${successful === 1 ? "" : "s"} • ${failed.map((result) => providerLabel(result.provider)).join(", ")} failed; previous choices retained`);
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      toast.error(detail || "Cover refresh failed");
    } finally {
      setIsRefreshing(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold">Cover Browser</h2>
            {title && <p className="mt-1 truncate text-sm text-gray-400">{title}</p>}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={handleRefresh} disabled={!bookId || isRefreshing} className="flex h-10 items-center gap-2 rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 text-sm text-violet-200 transition hover:bg-violet-500/20 disabled:opacity-50">
              <RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Refreshing..." : "Refresh Covers"}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="h-10 rounded-lg bg-blue-600 px-3 text-sm transition hover:bg-blue-500">Upload Cover</button>
            <button type="button" onClick={onClose} aria-label="Close cover browser" className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 transition hover:bg-gray-700"><X size={18} /></button>
          </div>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file) await handleUpload(file);
            event.target.value = "";
          }} />
          {covers.length === 0 ? <div className="text-gray-400">No covers available.</div> : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 xl:gap-6">
              {covers.map((cover, index) => {
                const selected = selectedCoverUrl === cover.url;
                return (
                  <button key={`${cover.url}-${index}`} type="button" onClick={() => onSelectCover?.(cover)} className="group space-y-3 text-left">
                    <div className={`aspect-[2/3] overflow-hidden rounded-xl border bg-black/30 transition ${selected ? "border-blue-500 ring-2 ring-blue-500/40" : "border-gray-800 group-hover:border-gray-600"}`}>
                      <img src={cover.url} alt={`Cover ${index + 1}`} className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-medium capitalize">{providerLabel(cover.provider)}</div>
                      <div className="text-xs text-gray-400">{cover.label}</div>
                      {selected && <div className="text-xs font-medium text-blue-400">Selected</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-800 bg-gray-900 px-4 py-4 sm:px-6">
          <button type="button" onClick={onMarkReviewed} className="min-h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500">
            Done — Mark Cover Reviewed
          </button>
        </div>
      </div>
    </div>
  );
}
