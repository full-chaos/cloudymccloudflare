import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type {
  AnalyticsDimensionAggregate,
  AnalyticsDimensionKey,
  AnalyticsRange,
  AnalyticsScope,
} from "../types";

export interface UseDimensionsReturn {
  data: AnalyticsDimensionAggregate | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function dimensionsCacheKey(
  scope: AnalyticsScope,
  dim: AnalyticsDimensionKey,
  range: AnalyticsRange,
): string {
  const id = scope.kind === "account" ? "_" : scope.id;
  return `${scope.kind}|${id}|${dim}|${range}`;
}

export function useDimensions(
  scope: AnalyticsScope | null,
  dim: AnalyticsDimensionKey,
  range: AnalyticsRange,
): UseDimensionsReturn {
  const [data, setData] = useState<AnalyticsDimensionAggregate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!scope) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    if (scope.kind !== "account" && !scope.id) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await api.analytics.dimensions(scope, dim, range);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dimensions");
    } finally {
      setLoading(false);
    }
  }, [scope, dim, range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refresh: fetchData };
}
