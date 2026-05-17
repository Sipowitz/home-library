import type { TreeNode } from "./tree";

export type CategoryStats = {
  total_books: number;

  read_books: number;

  unread_books: number;
};

export type Category = TreeNode<Category> & {
  stats: CategoryStats;
};
