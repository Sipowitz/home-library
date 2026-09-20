import type { CatalogSearchCandidate } from "../../api/books";
import { ActionButton } from "../ui/ActionButton";

type Props = {
  items: CatalogSearchCandidate[];
  visibleCount: number;
  onSelect: (candidate: CatalogSearchCandidate) => void;
  onShowMore: () => void;
};

export function BookSearchResults({ items, visibleCount, onSelect, onShowMore }: Props) {
  const visibleItems = items.slice(0, visibleCount);

  return (
    <section className="mt-4" aria-label="Catalog search results">
      <p className="mb-2 text-sm text-text-muted">
        {items.length} catalog {items.length === 1 ? "result" : "results"}
      </p>
      <div className="space-y-2">
        {visibleItems.map((candidate) => (
          <button
            key={candidate.candidate_key}
            type="button"
            className="flex w-full gap-3 rounded-lg border border-border bg-surface p-2 text-left transition hover:border-primary/50 hover:bg-surface-raised"
            onClick={() => onSelect(candidate)}
          >
            <div className="flex h-20 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-raised">
              {candidate.cover_url ? (
                <img src={candidate.cover_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-xs text-text-muted">No cover</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-text-primary">{candidate.title}</p>
              {candidate.subtitle && <p className="truncate text-sm text-text-secondary">{candidate.subtitle}</p>}
              {candidate.author && <p className="truncate text-sm text-text-secondary">{candidate.author}</p>}
              <p className="mt-1 text-xs text-text-muted">
                {[candidate.publisher, candidate.year].filter(Boolean).join(" · ")}
                {candidate.isbn && `${candidate.publisher || candidate.year ? " · " : ""}ISBN ${candidate.isbn}`}
              </p>
            </div>
          </button>
        ))}
      </div>
      {visibleCount < items.length && (
        <ActionButton className="mt-3" variant="tertiary" onClick={onShowMore}>
          Show more
        </ActionButton>
      )}
    </section>
  );
}
