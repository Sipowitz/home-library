import { useCategories } from "../../context/CategoryContext";

import { CategoryTreePanel } from "./CategoryTreePanel";

export function CategorySettings() {
  const { categories } = useCategories();

  return (
    <div
      className="
        relative
        h-[82vh]
        rounded-2xl
        border border-gray-800
        bg-gray-900/40
        overflow-hidden
      "
    >
      <CategoryTreePanel categories={categories} />
    </div>
  );
}
