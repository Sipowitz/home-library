import { useCallback, useEffect, useRef, useState } from "react";
import {
  getReviewQueue,
  type ReviewAspect,
  type ReviewQueueResponse,
  type ReviewReason,
} from "../api/maintenance";

const PAGE_SIZE = 50;

export function useMaintenance(enabled: boolean) {
  const [data, setData] = useState<ReviewQueueResponse | null>(null);
  const [aspect, setAspect] = useState<ReviewAspect>("all");
  const [reason, setReason] = useState<ReviewReason>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return null;
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    try {
      const result = await getReviewQueue({
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
        aspect,
        reason,
        search: search.trim() || undefined,
      });
      if (requestId === requestRef.current) setData(result);
      return result;
    } catch (err) {
      console.error("Failed to load review queue", err);
      if (requestId === requestRef.current) setError("The review queue could not be loaded.");
      return null;
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [aspect, enabled, page, reason, search]);

  useEffect(() => {
    const timer = window.setTimeout(load, search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  function changeAspect(value: ReviewAspect) {
    setPage(0);
    setAspect(value);
  }
  function changeReason(value: ReviewReason) {
    setPage(0);
    setReason(value);
  }
  function changeSearch(value: string) {
    setPage(0);
    setSearch(value);
  }

  return {
    data, loading, error, aspect, reason, search, page, pageSize: PAGE_SIZE,
    setAspect: changeAspect, setReason: changeReason, setSearch: changeSearch,
    setPage, refresh: load,
  };
}
