import { and, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";
import type { Database } from "../db";
import {
  analyticsSyncLog,
  analyticsZoneHourly,
  groupZones,
  groups as groupsTable,
  zoneCache,
} from "../db/schema";
import type {
  AccountAnalytics,
  AccountTotals,
  AnalyticsRange,
  AnalyticsStatus,
  GroupAnalytics,
  ZoneAnalytics,
  ZoneMetrics,
  ZoneTimeSeriesPoint,
} from "@shared/types";

// ─── Window math ──────────────────────────────────────────────────────────────

export interface RangeWindow {
  since: string; // ISO
  until: string; // ISO
  /** Number of hourly buckets in the window. */
  hours: number;
}

const RANGE_HOURS: Record<AnalyticsRange, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
};

/**
 * Convert an AnalyticsRange into a concrete {since, until} window, snapped to
 * the hourly bucket grid.
 *
 * Chosen behavior: both `since` and `until` snap to the start of the hour,
 * producing exactly N complete buckets. The current (partial) hour is
 * excluded, so charts stay stable across refreshes instead of shimmering as
 * the active bucket accumulates.
 *
 * Trade-off accepted: on a 2:37pm refresh, "24h" shows 1pm yesterday through
 * 1pm today — users miss the most recent 37 minutes of traffic.
 */
export function rangeToWindow(range: AnalyticsRange, now: Date = new Date()): RangeWindow {
  const untilDate = new Date(now);
  untilDate.setUTCMinutes(0, 0, 0); // snap to start of current UTC hour
  const hours = RANGE_HOURS[range];
  const sinceDate = new Date(untilDate);
  sinceDate.setUTCHours(sinceDate.getUTCHours() - hours);
  return {
    since: sinceDate.toISOString(),
    until: untilDate.toISOString(),
    hours,
  };
}

/**
 * Cache hit ratio in [0, 1], or NaN for "no data".
 *
 * Chosen behavior: when `bytes === 0` (no traffic in window), return NaN.
 * UI renders that as "—" so users don't misread "0%" as a cache failure.
 * Clamps `cachedBytes > bytes` (can happen with sampling noise) to 1.
 */
export function computeCacheHitRatio(bytes: number, cachedBytes: number): number {
  if (bytes <= 0) return Number.NaN;
  const ratio = cachedBytes / bytes;
  if (ratio < 0) return 0;
  if (ratio > 1) return 1;
  return ratio;
}

// ─── Aggregator: Account ──────────────────────────────────────────────────────

export async function getAccountAnalytics(
  db: Database,
  range: AnalyticsRange,
): Promise<AccountAnalytics> {
  const { since, until } = rangeToWindow(range);

  const accountZoneRows = await db.select({ id: zoneCache.id }).from(zoneCache);
  const zoneIds = accountZoneRows.map((z) => z.id);

  const perZoneRows = await db
    .select({
      zoneId: analyticsZoneHourly.zoneId,
      zoneName: zoneCache.name,
      requests: sql<number>`COALESCE(SUM(${analyticsZoneHourly.requests}), 0)`,
      bytes: sql<number>`COALESCE(SUM(${analyticsZoneHourly.bytes}), 0)`,
      cachedBytes: sql<number>`COALESCE(SUM(${analyticsZoneHourly.cachedBytes}), 0)`,
      threats: sql<number>`COALESCE(SUM(${analyticsZoneHourly.threats}), 0)`,
      sampleInterval: sql<number>`MAX(${analyticsZoneHourly.sampleInterval})`,
    })
    .from(analyticsZoneHourly)
    .leftJoin(zoneCache, eq(zoneCache.id, analyticsZoneHourly.zoneId))
    .where(
      and(
        gte(analyticsZoneHourly.hourBucket, since),
        lt(analyticsZoneHourly.hourBucket, until),
      ),
    )
    .groupBy(analyticsZoneHourly.zoneId, zoneCache.name);

  const perZone: ZoneMetrics[] = perZoneRows.map((r) => ({
    zoneId: r.zoneId,
    zoneName: r.zoneName ?? undefined,
    requests: Number(r.requests),
    bytes: Number(r.bytes),
    cachedBytes: Number(r.cachedBytes),
    threats: Number(r.threats),
  }));

  const totals = summarize(perZone);
  const sampleInterval = perZoneRows.reduce(
    (max, r) => Math.max(max, Number(r.sampleInterval) || 1),
    1,
  );
  const lastFetchedAt = await getLastFetchedAt(db);
  const series = await fillAggregatedHourlySeries(db, zoneIds, range, lastFetchedAt);

  return {
    range,
    windowStart: since,
    windowEnd: until,
    totals,
    perZone,
    series,
    lastFetchedAt,
    sampleInterval,
  };
}

// ─── Aggregator: Group ────────────────────────────────────────────────────────

export async function getGroupAnalytics(
  db: Database,
  groupId: string,
  range: AnalyticsRange,
): Promise<GroupAnalytics | null> {
  const { since, until } = rangeToWindow(range);

  const groupRows = await db
    .select({ id: groupsTable.id, name: groupsTable.name })
    .from(groupsTable)
    .where(eq(groupsTable.id, groupId))
    .limit(1);
  if (groupRows.length === 0) return null;
  const group = groupRows[0];

  // Pull all zoneIds in the group so we preserve zones with zero traffic.
  const memberZoneRows = await db
    .select({ zoneId: groupZones.zoneId, zoneName: groupZones.zoneName })
    .from(groupZones)
    .where(eq(groupZones.groupId, groupId));

  if (memberZoneRows.length === 0) {
    return {
      range,
      windowStart: since,
      windowEnd: until,
      groupId: group.id,
      groupName: group.name,
      zoneCount: 0,
      totals: emptyTotals(),
      perZone: [],
      lastFetchedAt: await getLastFetchedAt(db),
      sampleInterval: 1,
    };
  }

  const zoneIds = memberZoneRows.map((z) => z.zoneId);

  const trafficRows = await db
    .select({
      zoneId: analyticsZoneHourly.zoneId,
      requests: sql<number>`COALESCE(SUM(${analyticsZoneHourly.requests}), 0)`,
      bytes: sql<number>`COALESCE(SUM(${analyticsZoneHourly.bytes}), 0)`,
      cachedBytes: sql<number>`COALESCE(SUM(${analyticsZoneHourly.cachedBytes}), 0)`,
      threats: sql<number>`COALESCE(SUM(${analyticsZoneHourly.threats}), 0)`,
      sampleInterval: sql<number>`MAX(${analyticsZoneHourly.sampleInterval})`,
    })
    .from(analyticsZoneHourly)
    .where(
      and(
        inArray(analyticsZoneHourly.zoneId, zoneIds),
        gte(analyticsZoneHourly.hourBucket, since),
        lt(analyticsZoneHourly.hourBucket, until),
      ),
    )
    .groupBy(analyticsZoneHourly.zoneId);

  const trafficByZone = new Map(trafficRows.map((r) => [r.zoneId, r]));

  // Hydrate: every member zone gets a row (zero-filled if no traffic).
  const perZone: ZoneMetrics[] = memberZoneRows.map((z) => {
    const t = trafficByZone.get(z.zoneId);
    return {
      zoneId: z.zoneId,
      zoneName: z.zoneName,
      requests: t ? Number(t.requests) : 0,
      bytes: t ? Number(t.bytes) : 0,
      cachedBytes: t ? Number(t.cachedBytes) : 0,
      threats: t ? Number(t.threats) : 0,
    };
  });

  const sampleInterval = trafficRows.reduce(
    (max, r) => Math.max(max, Number(r.sampleInterval) || 1),
    1,
  );

  return {
    range,
    windowStart: since,
    windowEnd: until,
    groupId: group.id,
    groupName: group.name,
    zoneCount: memberZoneRows.length,
    totals: summarize(perZone),
    perZone,
    lastFetchedAt: await getLastFetchedAt(db),
    sampleInterval,
  };
}

// ─── Aggregator: Zone ─────────────────────────────────────────────────────────

export async function getZoneAnalytics(
  db: Database,
  zoneId: string,
  range: AnalyticsRange,
): Promise<ZoneAnalytics> {
  const { since, until } = rangeToWindow(range);

  const zoneRow = await db
    .select({ name: zoneCache.name })
    .from(zoneCache)
    .where(eq(zoneCache.id, zoneId))
    .limit(1);
  const zoneName = zoneRow[0]?.name;

  const buckets = await db
    .select({
      hourBucket: analyticsZoneHourly.hourBucket,
      requests: analyticsZoneHourly.requests,
      bytes: analyticsZoneHourly.bytes,
      cachedBytes: analyticsZoneHourly.cachedBytes,
      threats: analyticsZoneHourly.threats,
      sampleInterval: analyticsZoneHourly.sampleInterval,
    })
    .from(analyticsZoneHourly)
    .where(
      and(
        eq(analyticsZoneHourly.zoneId, zoneId),
        gte(analyticsZoneHourly.hourBucket, since),
        lt(analyticsZoneHourly.hourBucket, until),
      ),
    )
    .orderBy(analyticsZoneHourly.hourBucket);

  const lastFetchedAt = await getLastFetchedAt(db);
  const series: ZoneTimeSeriesPoint[] = fillHourlySeries(buckets, since, until, lastFetchedAt);

  const sampleInterval = buckets.reduce(
    (max, b) => Math.max(max, b.sampleInterval || 1),
    1,
  );

  const zoneTotals = summarize([
    {
      zoneId,
      zoneName,
      requests: buckets.reduce((s, b) => s + b.requests, 0),
      bytes: buckets.reduce((s, b) => s + b.bytes, 0),
      cachedBytes: buckets.reduce((s, b) => s + b.cachedBytes, 0),
      threats: buckets.reduce((s, b) => s + b.threats, 0),
    },
  ]);

  return {
    range,
    windowStart: since,
    windowEnd: until,
    zoneId,
    zoneName,
    totals: zoneTotals,
    series,
    lastFetchedAt,
    sampleInterval,
  };
}

// ─── Status ───────────────────────────────────────────────────────────────────

export async function getAnalyticsStatus(db: Database): Promise<AnalyticsStatus> {
  const [countRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(analyticsZoneHourly);

  const lastRun = await db
    .select()
    .from(analyticsSyncLog)
    .orderBy(desc(analyticsSyncLog.startedAt))
    .limit(1);

  const lastSuccess = await db
    .select({ finishedAt: analyticsSyncLog.finishedAt })
    .from(analyticsSyncLog)
    .where(eq(analyticsSyncLog.status, "success"))
    .orderBy(desc(analyticsSyncLog.finishedAt))
    .limit(1);

  const lastRunRow = lastRun[0];
  return {
    lastFetchedAt: lastSuccess[0]?.finishedAt ?? null,
    rowCount: Number(countRow?.count ?? 0),
    lastRunStatus: (lastRunRow?.status as AnalyticsStatus["lastRunStatus"]) ?? "never",
    lastRunError: lastRunRow?.error ?? null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function summarize(perZone: ZoneMetrics[]): AccountTotals {
  const totals = perZone.reduce(
    (acc, z) => ({
      requests: acc.requests + z.requests,
      bytes: acc.bytes + z.bytes,
      cachedBytes: acc.cachedBytes + z.cachedBytes,
      threats: acc.threats + z.threats,
    }),
    { requests: 0, bytes: 0, cachedBytes: 0, threats: 0 },
  );
  return {
    ...totals,
    cacheHitRatio: computeCacheHitRatio(totals.bytes, totals.cachedBytes),
  };
}

function emptyTotals(): AccountTotals {
  return {
    requests: 0,
    bytes: 0,
    cachedBytes: 0,
    threats: 0,
    cacheHitRatio: Number.NaN,
  };
}

/**
 * Build a contiguous hourly series covering [since, until) — one entry per
 * hour across the full window, so the chart's x-axis always spans the range
 * picker's promise.
 *
 * Values are `null` outside the "fetched range" and numeric (real or zero)
 * inside it. The fetched range is:
 *   [earliest bucket in `buckets`, min(until, lastFetchedAt snapped to hour))
 *
 * Nulls become visible gaps in the chart (with `connectNulls={false}`) and
 * keep Recharts' activeDot from pinning to a fake flat-zero region. Inside
 * the fetched range, missing-bucket hours are zero — we asked CF and it
 * returned nothing for that hour, so zero traffic is the correct inference.
 *
 * Timestamp key normalization: CF's `datetime` comes back as
 * "2026-04-18T17:00:00Z" (no ms); `since`/`until` come from `toISOString()`
 * (".000Z"). Equality fails across those formats — use epoch millis.
 */
const HOUR_MS = 60 * 60 * 1000;

export function fillHourlySeries(
  buckets: Array<{
    hourBucket: string;
    requests: number;
    bytes: number;
    cachedBytes: number;
    threats: number;
  }>,
  since: string,
  until: string,
  lastFetchedAt: string | null,
): ZoneTimeSeriesPoint[] {
  const byEpoch = new Map(buckets.map((b) => [Date.parse(b.hourBucket), b] as const));
  const startMs = Date.parse(since);
  const endMs = Date.parse(until);
  const fetchedStartMs = buckets.length > 0 ? Date.parse(buckets[0].hourBucket) : null;
  const fetchedEndMs = lastFetchedAt
    ? Math.floor(Date.parse(lastFetchedAt) / HOUR_MS) * HOUR_MS
    : null;

  const series: ZoneTimeSeriesPoint[] = [];
  for (let ms = startMs; ms < endMs; ms += HOUR_MS) {
    const inFetchedRange =
      fetchedStartMs !== null &&
      fetchedEndMs !== null &&
      ms >= fetchedStartMs &&
      ms < fetchedEndMs;
    const b = byEpoch.get(ms);
    series.push({
      timestamp: new Date(ms).toISOString(),
      requests: inFetchedRange ? b?.requests ?? 0 : null,
      bytes: inFetchedRange ? b?.bytes ?? 0 : null,
      cachedBytes: inFetchedRange ? b?.cachedBytes ?? 0 : null,
      threats: inFetchedRange ? b?.threats ?? 0 : null,
    });
  }
  return series;
}

export async function fillAggregatedHourlySeries(
  db: Database,
  zoneIds: string[],
  range: AnalyticsRange,
  lastFetchedAtOverride?: string | null,
): Promise<ZoneTimeSeriesPoint[]> {
  const { since, until } = rangeToWindow(range);
  const lastFetchedAt = lastFetchedAtOverride ?? (await getLastFetchedAt(db));

  if (zoneIds.length === 0) {
    return fillHourlySeries([], since, until, lastFetchedAt);
  }

  const buckets = await db
    .select({
      hourBucket: analyticsZoneHourly.hourBucket,
      requests: sql<number>`COALESCE(SUM(${analyticsZoneHourly.requests}), 0)`,
      bytes: sql<number>`COALESCE(SUM(${analyticsZoneHourly.bytes}), 0)`,
      cachedBytes: sql<number>`COALESCE(SUM(${analyticsZoneHourly.cachedBytes}), 0)`,
      threats: sql<number>`COALESCE(SUM(${analyticsZoneHourly.threats}), 0)`,
    })
    .from(analyticsZoneHourly)
    .where(
      and(
        inArray(analyticsZoneHourly.zoneId, zoneIds),
        gte(analyticsZoneHourly.hourBucket, since),
        lt(analyticsZoneHourly.hourBucket, until),
      ),
    )
    .groupBy(analyticsZoneHourly.hourBucket)
    .orderBy(analyticsZoneHourly.hourBucket);

  return fillHourlySeries(
    buckets.map((b) => ({
      hourBucket: b.hourBucket,
      requests: Number(b.requests),
      bytes: Number(b.bytes),
      cachedBytes: Number(b.cachedBytes),
      threats: Number(b.threats),
    })),
    since,
    until,
    lastFetchedAt,
  );
}

async function getLastFetchedAt(db: Database): Promise<string | null> {
  const rows = await db
    .select({ finishedAt: analyticsSyncLog.finishedAt })
    .from(analyticsSyncLog)
    .where(eq(analyticsSyncLog.status, "success"))
    .orderBy(desc(analyticsSyncLog.finishedAt))
    .limit(1);
  return rows[0]?.finishedAt ?? null;
}
