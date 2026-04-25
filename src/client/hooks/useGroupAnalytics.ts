import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AnalyticsRange, GroupAnalytics } from "../types";

export interface UseGroupAnalyticsReturn {
  data: GroupAnalytics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGroupAnalytics(
  groupId: string | null,
  range: AnalyticsRange,
): UseGroupAnalyticsReturn {
  const [data, setData] = useState<GroupAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!groupId) {
      setData(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await api.analytics.group(groupId, range, { includePerZoneSeries: true });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load group analytics");
    } finally {
      setLoading(false);
    }
  }, [groupId, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
