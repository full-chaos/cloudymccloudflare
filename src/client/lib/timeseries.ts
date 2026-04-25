import type { AnalyticsRange, ZoneTimeSeriesPoint } from "@shared/types";

/**
 * Bins hourly series into UTC days while preserving null gaps: a day's metric is
 * null only if every hour for that metric is null/undefined; otherwise non-null
 * hours are summed and missing hours are ignored.
 */

const METRICS = ["requests", "bytes", "cachedBytes", "threats"] as const;
type MetricKey = (typeof METRICS)[number];

function sumMetric(hours: ZoneTimeSeriesPoint[], metric: MetricKey): number | null {
  let sum: number | null = null;
  for (const hour of hours) {
    const value = hour[metric];
    if (value !== null && value !== undefined) sum = (sum ?? 0) + value;
  }
  return sum;
}

export function binByDay(series: ZoneTimeSeriesPoint[]): ZoneTimeSeriesPoint[] {
  const buckets = new Map<string, ZoneTimeSeriesPoint[]>();

  for (const point of series) {
    const dayKey = new Date(point.timestamp).toISOString().slice(0, 10);
    const dayBucket = buckets.get(dayKey);
    if (dayBucket) {
      dayBucket.push(point);
    } else {
      buckets.set(dayKey, [point]);
    }
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dayKey, hours]) => ({
      timestamp: `${dayKey}T00:00:00.000Z`,
      requests: sumMetric(hours, "requests"),
      bytes: sumMetric(hours, "bytes"),
      cachedBytes: sumMetric(hours, "cachedBytes"),
      threats: sumMetric(hours, "threats"),
    }));
}

export function binSeriesIfNeeded(series: ZoneTimeSeriesPoint[], range: AnalyticsRange): ZoneTimeSeriesPoint[] {
  return range === "30d" ? binByDay(series) : series;
}

export function binSeriesByKeyIfNeeded(
  seriesByKey: Record<string, ZoneTimeSeriesPoint[]>,
  range: AnalyticsRange,
): Record<string, ZoneTimeSeriesPoint[]> {
  const result: Record<string, ZoneTimeSeriesPoint[]> = {};
  for (const [key, value] of Object.entries(seriesByKey)) {
    result[key] = binSeriesIfNeeded(value, range);
  }
  return result;
}
