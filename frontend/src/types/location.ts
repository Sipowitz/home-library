import type { TreeNode } from "./tree";

export interface Location extends TreeNode<Location> {
  id: number;

  name: string;

  parent_id?: number | null;
}
