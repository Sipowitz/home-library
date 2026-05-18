import type { TreeNode } from "./tree";

export interface Category extends TreeNode<Category> {
  id: number;

  name: string;

  parent_id?: number | null;

  stats?: {
    total_books?: number;

    read_books?: number;

    unread_books?: number;
  };
}
