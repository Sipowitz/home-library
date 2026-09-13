import { useEffect, useId, useMemo, useRef, useState } from "react";

import { ChevronDown } from "lucide-react";

import type { SeriesTreeNode } from "../../../types/series";

type Props = {
  roots: SeriesTreeNode[];
  selectedId: number | null;
  onSelect: (id: number) => void;
};

export function SeriesRootCombobox({ roots, selectedId, onSelect }: Props) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selected = roots.find((root) => root.id === selectedId) ?? null;
  const filteredRoots = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized
      ? roots.filter((root) => root.name.toLowerCase().includes(normalized))
      : roots;
  }, [query, roots]);

  useEffect(() => {
    function closeOnOutsidePointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsidePointer);
    return () => document.removeEventListener("mousedown", closeOnOutsidePointer);
  }, []);

  function openSelector() {
    setQuery("");
    setActiveIndex(Math.max(0, roots.findIndex((root) => root.id === selectedId)));
    setOpen(true);
  }

  function choose(id: number) {
    onSelect(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-label="Select root collection"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          value={open ? query : selected?.name ?? ""}
          placeholder="Search root collections..."
          onFocus={openSelector}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              if (!open) openSelector();
              else if (filteredRoots.length > 0) {
                setActiveIndex((index) => Math.min(index + 1, filteredRoots.length - 1));
              }
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(0, index - 1));
            } else if (event.key === "Enter" && open && filteredRoots[activeIndex]) {
              event.preventDefault();
              choose(filteredRoots[activeIndex].id);
            } else if (event.key === "Escape") {
              setOpen(false);
              setQuery("");
              inputRef.current?.blur();
            }
          }}
          className="form-control w-full rounded-xl py-2 pl-3 pr-9 text-sm"
        />
        <button
          type="button"
          aria-label="Open root collection selector"
          tabIndex={-1}
          onClick={() => {
            if (open) setOpen(false);
            else {
              openSelector();
              inputRef.current?.focus();
            }
          }}
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-text-muted"
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 max-h-64 overflow-y-auto rounded-xl border border-border-strong bg-surface p-1 shadow-xl"
        >
          {filteredRoots.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-muted">No root collections found.</p>
          ) : filteredRoots.map((root, index) => (
            <button
              key={root.id}
              type="button"
              role="option"
              aria-selected={root.id === selectedId}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(root.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                index === activeIndex
                  ? "bg-surface-raised text-text-primary"
                  : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              }`}
            >
              <span className="block truncate">{root.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
