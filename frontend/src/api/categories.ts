import client from "./client";

import type { Category } from "../types/category";

type CategoryCreateInput = {
  name: string;
  parent_id?: number | null;
};

// -------------------
// 📥 FETCH
// -------------------
export async function fetchCategories(): Promise<Category[]> {
  // ✅ backend expects trailing slash
  const res = await client.get("/categories/");

  return res.data;
}

// -------------------
// ➕ CREATE
// -------------------
export async function createCategory(
  name: string,
  parent_id?: number,
): Promise<Category> {
  const payload: CategoryCreateInput = {
    name,
    parent_id: parent_id ?? null,
  };

  // ✅ backend expects trailing slash
  const res = await client.post("/categories/", payload);

  return res.data;
}

// -------------------
// ❌ DELETE
// -------------------
export async function deleteCategory(id: number): Promise<void> {
  // ✅ backend expects NO trailing slash
  await client.delete(`/categories/${id}`);
}
