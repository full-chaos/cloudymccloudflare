import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AnalyticsRange, ClusterAnalytics } from "../types";

export interface UseClusterAnalyticsReturn {
  data: ClusterAnalytics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useClusterAnalytics(
  clusterName: string | null,
  range: AnalyticsRange,
): UseClusterAnalyticsReturn {
  const [data, setData] = useState<ClusterAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!clusterName) {
      setData(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await api.analytics.cluster(clusterName, range);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cluster analytics");
    } finally {
      setLoading(false);
    }
  }, [clusterName, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
