import { Flashlight, FlashlightOff, X } from "lucide-react";

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex justify-between items-center p-4 border-b border-gray-800">
        <h2 className="text-white text-lg">Scan ISBN</h2>

        <div className="flex items-center gap-2">
          {torchSupported && (
            <button
              onClick={onToggleTorch}
              className="text-white p-2 rounded-lg hover:bg-gray-800"
            >
              {torchOn ? <FlashlightOff size={20} /> : <Flashlight size={20} />}
            </button>
          )}

          <button
            onClick={onClose}
            className="text-white p-2 rounded-lg hover:bg-gray-800"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div
          id={scannerRegionId}
          className="w-full max-w-md overflow-hidden rounded-2xl"
        />
      </div>
    </div>
  );
}
