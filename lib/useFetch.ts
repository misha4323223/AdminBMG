import { useCallback, useEffect, useState } from "react";
import { apiGet, getErrorMessage } from "./api";

export function useFetch<T>(url: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const res = await apiGet<T>(url);
        setData(res);
      } catch (e) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [url],
  );

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  return { data, setData, loading, refreshing, error, reload: () => load(true), load };
}
