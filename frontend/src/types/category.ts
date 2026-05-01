export type Category = {
  id: number;
  name: string;
  parent_id?: number | null;
  children?: Category[];
};
