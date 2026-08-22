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
        border border-gray-800/70 lg:border-gray-800
        bg-gray-900/20 lg:bg-gray-900/40
        overflow-visible lg:overflow-hidden
      "
    >
      <CategoryTreePanel categories={categories} />
    </div>
  );
}
