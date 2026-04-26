import { useEffect, useState } from "react";

type Params = {
  isAuthenticated: boolean;
  updateFilters: (filters: {
    search?: string;
    locationId?: number | null;
  }) => void;
};

export function useSearch({ isAuthenticated, updateFilters }: Params) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [prevSearch, setPrevSearch] = useState("");

  // -------------------
  // ⏱️ DEBOUNCE
  // -------------------
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, 200);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  // -------------------
  // 🔍 APPLY FILTERS (SEARCH ONLY)
  // -------------------
  useEffect(() => {
    if (!isAuthenticated) return;

    updateFilters({
      search: debouncedSearch,
      locationId: null, // keep your existing behaviour
    });

    if (debouncedSearch !== prevSearch) {
      if (window.innerWidth >= 768) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }

      setPrevSearch(debouncedSearch);
    }
  }, [debouncedSearch, isAuthenticated]);

  return {
    searchInput,
    setSearchInput,
  };
}
