import client from "./client";

export type Category = {
  id: number;
  name: string;
  parent_id: number | null;
  children?: Category[];
};

// ✅ FIXED — trailing slash
export async function fetchCategories(): Promise<Category[]> {
  const res = await client.get("/categories/");
  return res.data;
}

// ✅ FIXED — trailing slash
export async function createCategory(name: string, parent_id?: number) {
  const res = await client.post("/categories/", {
    name,
    parent_id: parent_id ?? null,
  });
  return res.data;
}

// ✅ CORRECT — no change needed
export async function deleteCategory(id: number) {
  await client.delete(`/categories/${id}`);
}
