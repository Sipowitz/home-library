// frontend/src/api/categories.ts

import axios from "axios";

import client from "./client";

import type { Category } from "../types/category";

type CategoryCreateInput = {
  name: string;

  parent_id?: number | null;
};

type CategoryUpdateInput = {
  name?: string;

  parent_id?: number | null;
};

// -------------------
// 📥 FETCH
// -------------------

export async function fetchCategories(): Promise<Category[]> {
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

  const res = await client.post("/categories/", payload);

  return res.data;
}

// -------------------
// ✏️ UPDATE
// -------------------

export async function updateCategory(
  id: number,
  data: CategoryUpdateInput,
): Promise<Category> {
  const res = await client.patch(`/categories/${id}`, data);

  return res.data;
}

// -------------------
// ❌ DELETE
// -------------------

export async function deleteCategory(id: number, cascade = false) {
  try {
    const res = await client.delete(`/categories/${id}?cascade=${cascade}`);

    return {
      success: true,

      data: res.data,
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      const payload = err.response?.data;

      // ⚠️ EXPECTED BLOCK
      if (err.response?.status === 409) {
        return {
          success: false,

          blocked: true,

          message: payload?.message?.message,

          descendants: payload?.message?.descendants ?? [],

          count: payload?.message?.count ?? 0,
        };
      }

      // ❌ REAL ERROR
      return {
        success: false,

        blocked: false,

        message: "Delete failed",
      };
    }

    return {
      success: false,

      blocked: false,

      message: "Unknown error",
    };
  }
}
