import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { ActionButton } from "./ActionButton";

type Props = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
};

export function Dialog({ open, title, onClose, children, className = "max-w-2xl" }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;
  const titleId = `dialog-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={onClose}>
      <div className={`max-h-[calc(100dvh-1.5rem)] w-full overflow-y-auto rounded-2xl border border-border-strong bg-canvas text-text-primary shadow-2xl ${className}`} onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-canvas/95 px-4 py-3 backdrop-blur">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <ActionButton variant="icon" size="icon" onClick={onClose} aria-label={`Close ${title}`}><X size={18} /></ActionButton>
        </div>
        {children}
      </div>
    </div>
  );
}
