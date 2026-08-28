import { ChevronDown, ChevronUp } from "lucide-react";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useRef,
  useState,
  type ReactElement,
} from "react";

type Props = {
  label: string;

  value: string;

  children: ReactElement<{ onSelected?: () => void }>;

  initiallyOpen?: boolean;

  floating?: boolean;
};

export function TreeSelectorField({
  label,
  value,
  children,
  initiallyOpen = false,
  floating = false,
}: Props) {
  const [open, setOpen] = useState(initiallyOpen);

  const containerRef = useRef<HTMLDivElement | null>(null);

  // ================= OUTSIDE CLICK =================

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // ================= INJECT CLOSE HANDLER =================

  const enhancedChild = isValidElement(children)
    ? cloneElement(children, {
        onSelected: () => setOpen(false),
      })
    : children;

  return (
    <div ref={containerRef} className={`relative ${open && floating ? "z-[60]" : ""}`}>
      {/* BUTTON */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="
          w-full
          px-4 py-3
          rounded-xl
          bg-gray-800/70
          border border-gray-700
          hover:border-gray-600
          transition
          text-left
          backdrop-blur-sm
        "
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">
              {label}
            </div>

            <div className="text-sm text-gray-100 truncate">{value}</div>
          </div>

          <div className="text-gray-400 flex-shrink-0">
            {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </div>
        </div>
      </button>

      {/* CONTENT */}
      {open && (
        <div
          className={`
            ${floating ? "absolute inset-x-0 top-full z-[60] mt-2 max-h-[min(24rem,calc(100dvh-8rem))] overflow-x-hidden overflow-y-auto" : "mt-2 overflow-hidden"}
            rounded-2xl
            border border-gray-700
            bg-gray-900/95
            backdrop-blur-xl
            shadow-2xl
            animate-in
            fade-in
            slide-in-from-top-1
            duration-150
          `}
        >
          {enhancedChild}
        </div>
      )}
    </div>
  );
}
