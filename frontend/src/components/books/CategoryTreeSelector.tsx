import type { Category } from "../../types/category";

import { TreeSelector } from "./tree/TreeSelector";

type Props = {
  categories: Category[];

  selectedCategoryId: number | null;

  onSelect: (id: number | null) => void;

  showSpecialOptions?: boolean;
};

export function CategoryTreeSelector({
  categories,
  selectedCategoryId,
  onSelect,
  showSpecialOptions = false,
}: Props) {
  return (
    <div className="space-y-2">
      {/* SPECIAL OPTIONS */}
      {showSpecialOptions && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`w-full text-left px-3 py-2 rounded text-sm ${
              selectedCategoryId === null
                ? "bg-blue-600/20 border border-blue-500/40"
                : "hover:bg-gray-800"
            }`}
          >
            All categories
          </button>

          <button
            type="button"
            onClick={() => onSelect(-1)}
            className={`w-full text-left px-3 py-2 rounded text-sm ${
              selectedCategoryId === -1
                ? "bg-blue-600/20 border border-blue-500/40"
                : "hover:bg-gray-800"
            }`}
          >
            No category
          </button>
        </div>
      )}

      <TreeSelector
        nodes={categories}
        selectedId={selectedCategoryId}
        onSelect={(id) => onSelect(id)}
        emptyLabel="None selected"
        clearLabel={!showSpecialOptions ? "No category" : undefined}
      />
    </div>
  );
}
