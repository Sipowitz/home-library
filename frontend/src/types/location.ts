export type Location = {
  id: number;
  name: string;
  parent_id?: number;
  children?: Location[];
};
