// frontend/src/components/settings/categories/CategorySettings.tsx

import { useCategories } from "../../../context/CategoryContext";

import { CategoryTreePanel } from "./CategoryTreePanel";

export function CategorySettings() {
  const { categories } = useCategories();

  return (
    <div
      className="
        relative
        rounded-lg lg:rounded-2xl
        border border-border
        bg-surface-muted/40
        overflow-visible lg:overflow-hidden
      "
    >
      <CategoryTreePanel categories={categories} />
    </div>
  );
}
