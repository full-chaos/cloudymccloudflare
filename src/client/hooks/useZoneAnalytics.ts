import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { AnalyticsRange, ZoneAnalytics } from "../types";

export interface UseZoneAnalyticsReturn {
  data: ZoneAnalytics | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useZoneAnalytics(
  zoneId: string | null,
  range: AnalyticsRange,
): UseZoneAnalyticsReturn {
  const [data, setData] = useState<ZoneAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!zoneId) {
      setData(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await api.analytics.zone(zoneId, range);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load zone analytics");
    } finally {
      setLoading(false);
    }
  }, [zoneId, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
