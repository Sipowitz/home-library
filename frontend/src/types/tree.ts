export type TreeNode<T = unknown> = {
  id: number;

  name: string;

  parent_id?: number | null;

  children?: T[];
};
