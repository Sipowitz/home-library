import { useEffect, useState } from "react";

import type { Category } from "../../types/category";

import { CategoryTreePanel } from "./CategoryTreePanel";

type Props = {
  categories: Category[];
};

export function CategorySettings({ categories }: Props) {
  const [localCategories, setLocalCategories] = useState(categories);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

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
      <CategoryTreePanel
        categories={localCategories}
        onRefresh={setLocalCategories}
      />
    </div>
  );
}
