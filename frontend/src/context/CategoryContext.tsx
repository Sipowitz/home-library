import { createContext, useContext, useEffect, useState } from "react";

import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from "../api/categories";

import { useAuth } from "./AuthContext";

import type { Category } from "../types/category";

type CategoryContextType = {
  categories: Category[];

  reloadCategories: () => Promise<void>;

  addCategory: (name: string, parentId?: number) => Promise<void>;

  editCategory: (
    id: number,
    data: {
      name?: string;
      parent_id?: number | null;
    },
  ) => Promise<void>;

  removeCategory: (id: number, cascade?: boolean) => Promise<any>;
};

type Props = {
  children: React.ReactNode;
};

const CategoryContext = createContext<CategoryContextType | null>(null);

export function CategoryProvider({ children }: Props) {
  const [categories, setCategories] = useState<Category[]>([]);

  const { token } = useAuth();

  // -------------------
  // 📥 LOAD
  // -------------------

  async function load(): Promise<void> {
    try {
      const data = await fetchCategories();

      setCategories(data);
    } catch (err) {
      console.error("Failed to load categories", err);

      setCategories([]);
    }
  }

  // -------------------
  // 🔐 AUTH LOAD
  // -------------------

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token) {
        setCategories([]);

        return;
      }

      try {
        const data = await fetchCategories();

        if (!cancelled) {
          setCategories(data);
        }
      } catch (err) {
        console.error("Failed to load categories", err);

        if (!cancelled) {
          setCategories([]);
        }
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [token]);

  // -------------------
  // ➕ CREATE
  // -------------------

  async function addCategory(name: string, parentId?: number): Promise<void> {
    await createCategory(name, parentId);

    await load();
  }

  // -------------------
  // ✏️ UPDATE
  // -------------------

  async function editCategory(
    id: number,
    data: {
      name?: string;
      parent_id?: number | null;
    },
  ): Promise<void> {
    await updateCategory(id, data);

    await load();
  }

  // -------------------
  // ❌ DELETE
  // -------------------

  async function removeCategory(id: number, cascade = false) {
    const result = await deleteCategory(id, cascade);

    if (result?.success) {
      await load();
    }

    return result;
  }

  return (
    <CategoryContext.Provider
      value={{
        categories,
        reloadCategories: load,
        addCategory,
        editCategory,
        removeCategory,
      }}
    >
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategories() {
  const ctx = useContext(CategoryContext);

  if (!ctx) {
    throw new Error("Must be inside CategoryProvider");
  }

  return ctx;
}
