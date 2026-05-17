// frontend/src/components/settings/categories/CategorySettings.tsx

import type { Category } from "../../../types/category";

import { CategoryTreePanel } from "./CategoryTreePanel";

type Props = {
  categories: Category[];
};

export function CategorySettings({ categories }: Props) {
  return (
    <div
      className="
        relative
        flex-1
        min-h-0
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
