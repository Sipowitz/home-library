import { useEffect, useState } from "react";

type Params = {
  isAuthenticated: boolean;
  selectedLocation: number | null;
  updateFilters: (filters: {
    search?: string;
    locationId?: number | null;
  }) => void;
};

export function useSearch({
  isAuthenticated,
  selectedLocation,
  updateFilters,
}: Params) {
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
  // 🔍 APPLY FILTERS
  // -------------------
  useEffect(() => {
    if (!isAuthenticated) return;

    updateFilters({
      search: debouncedSearch,
      locationId: selectedLocation,
    });

    if (debouncedSearch !== prevSearch) {
      if (window.innerWidth >= 768) {
        window.scrollTo({ top: 0, behavior: "auto" });
      }

      setPrevSearch(debouncedSearch);
    }
  }, [debouncedSearch, selectedLocation, isAuthenticated]);

  return {
    searchInput,
    setSearchInput,
  };
}
