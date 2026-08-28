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
    <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <h2 className="text-white text-lg">Scan ISBN</h2>

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

      <div className="flex-1 flex items-center justify-center p-4">
        <div
          id={scannerRegionId}
          className="w-full max-w-md overflow-hidden rounded-2xl"
        />
      </div>
    </div>,
    document.body,
  );
}
