import { Flashlight, FlashlightOff, X } from "lucide-react";
import { createPortal } from "react-dom";
import { ActionButton } from "../ui/ActionButton";

type Props = {
  open: boolean;
  scannerRegionId: string;
  torchSupported: boolean;
  torchOn: boolean;
  onToggleTorch: () => void;
  onClose: () => void;
};

export function ISBNScannerModal({
  open,
  scannerRegionId,
  torchSupported,
  torchOn,
  onToggleTorch,
  onClose,
}: Props) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 sm:p-4">
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-canvas text-text-primary shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:max-w-[560px] sm:rounded-2xl sm:border sm:border-border-strong"
        role="dialog"
        aria-modal="true"
        aria-labelledby="isbn-scanner-title"
      >
        <div className="flex items-center justify-between border-b border-border bg-surface p-4 dark:bg-canvas">
          <h2 id="isbn-scanner-title" className="text-lg font-medium text-text-primary">Scan ISBN</h2>

          <div className="flex items-center gap-2">
            {torchSupported && (
              <ActionButton
                variant="icon"
                size="icon"
                onClick={onToggleTorch}
                aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
              >
                {torchOn ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
              </ActionButton>
            )}

            <ActionButton
              variant="icon"
              size="icon"
              onClick={onClose}
              aria-label="Close ISBN scanner"
            >
              <X size={20} />
            </ActionButton>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-black p-3 sm:flex-none sm:p-4">
          <div
            id={scannerRegionId}
            className="w-full overflow-hidden rounded-xl bg-black [&_video]:!h-auto [&_video]:!w-full"
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
