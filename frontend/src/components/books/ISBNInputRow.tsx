import { Camera } from "lucide-react";
import { ActionButton } from "../ui/ActionButton";

type Props = {
  isbn: string;
  onChange: (value: string) => void;
  onOpenScanner: () => void;
  disabled?: boolean;
};

export function ISBNInputRow({
  isbn,
  onChange,
  onOpenScanner,
  disabled = false,
}: Props) {
  return (
    <div className="mb-4">
      <label className="text-xs text-text-muted">ISBN</label>

      <div className="flex items-stretch gap-2 mt-1 min-w-0">
        <input
          placeholder="Scan or enter ISBN..."
          className="form-control min-w-0 flex-1 rounded-lg p-2"
          value={isbn}
          disabled={disabled}
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
              disabled={disabled}
              aria-label="Scan ISBN with camera"
            >
              <Camera size={16} />
            </ActionButton>
          )}
      </div>
    </div>
  );
}
