// frontend/src/components/settings/categories/tree/CategoryTreeFlow.tsx

import type { Category } from "../../../../types/category";

import { BaseTreeFlow } from "../../shared/BaseTreeFlow";

import { CategoryTreeNode } from "./CategoryTreeNode";

type Props = {
  categories: Category[];

  focusedId: number | null;

  focusedPath: number[];

  searchTargetId: string | null;

  onFocus: (id: number) => void;

  onRename: (id: number, name: string) => Promise<void>;

  onAddChild: (parentId: number, name: string) => Promise<void>;

  onDelete: (id: number, cascade?: boolean) => Promise<any>;
};

export function CategoryTreeFlow({
  categories,
  focusedId,
  focusedPath,
  searchTargetId,
  onFocus,
  onRename,
  onAddChild,
  onDelete,
}: Props) {
  return (
    <BaseTreeFlow
      items={categories}
      focusedId={focusedId}
      focusedPath={focusedPath}
      searchTargetId={searchTargetId}
      nodeType="categoryNode"
      nodeComponent={CategoryTreeNode}
      onFocus={onFocus}
      onRename={onRename}
      onAddChild={onAddChild}
      onDelete={onDelete}
    />
  );
}
