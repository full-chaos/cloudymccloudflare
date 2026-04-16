import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AccountAnalytics, AnalyticsRange } from "../types";

export interface UseAccountAnalyticsReturn {
  data: AccountAnalytics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAccountAnalytics(range: AnalyticsRange): UseAccountAnalyticsReturn {
  const [data, setData] = useState<AccountAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.analytics.account(range);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
