import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { Bindings } from "../types/env";
import { createDb } from "../db";
import {
  analyticsLocks,
  analyticsSyncLog,
  analyticsZoneCountryHourly,
  analyticsZoneFirewallHourly,
  analyticsZoneHourly,
  analyticsZoneHttpVersionHourly,
  analyticsZoneSslVersionHourly,
  analyticsZoneStatusHourly,
} from "../db/schema";
import { CloudflareClient } from "./cloudflare";

// ─── Configuration ────────────────────────────────────────────────────────────

/** Cloudflare GraphQL allows up to 10 zones per `zoneTag_in` filter. */
const ZONE_CHUNK_SIZE = 10;

/** Cloudflare GraphQL analytics rejects per-zone ranges wider than 3 days. */
const MAX_GRAPHQL_WINDOW_HOURS = 24 * 3;

/** firewallEventsAdaptive rejects ranges wider than 1 day. */
const MAX_FIREWALL_WINDOW_HOURS = 24;

/**
 * Cloudflare GraphQL also rejects requests whose oldest timestamp is more than
 * about ~3 days behind "now". Use a conservative 48h lookback for refreshes.
 */
const MAX_GRAPHQL_LOOKBACK_HOURS = 48;

/**
 * Overlap (re-fetch) hours beyond the last success.
 * Belt-and-braces: the CF hourly bucket for the current hour is always partial
 * until the hour closes. Re-fetching the tail prevents under-counting.
 */
const OVERLAP_HOURS = 2;

/**
 * D1 insert batch chunk. SQLite caps bound parameters at ~100 per statement
 * on Workers runtime (lower than stock SQLite's 999). Row has 7 columns → 14
 * rows keeps us at 98 params, comfortably under.
 */
const UPSERT_CHUNK_SIZE = 14;
const BACKFILL_LOCK_NAME = "analytics-backfill";
const BACKFILL_LOCK_TTL_MS = 14 * 60 * 1000;
const DIMENSION_RETENTION_DAYS = 30;
const COUNTRY_TOP_N_PER_BUCKET = 50;

// ─── GraphQL query ────────────────────────────────────────────────────────────

const ZONE_BATCH_QUERY = `
query ZoneBatch($zoneTags: [string!]!, $since: Time!, $until: Time!) {
  viewer {
    zones(filter: { zoneTag_in: $zoneTags }) {
      zoneTag
      httpRequests1hGroups(
        limit: 10000
        filter: { datetime_geq: $since, datetime_leq: $until }
        orderBy: [datetime_DESC]
      ) {
        dimensions { datetime }
        sum {
          requests
          bytes
          cachedBytes
          threats
          countryMap { clientCountryName, requests }
          responseStatusMap { edgeResponseStatus, requests }
          clientHTTPVersionMap { clientHTTPProtocol, requests }
          clientSSLMap { clientSSLProtocol, requests }
        }
        avg { sampleInterval }
      }
    }
  }
}`;

export const FIREWALL_EVENTS_QUERY = `
query FirewallEvents($zoneTag: string!, $since: Time!, $until: Time!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      zoneTag
      firewallEventsAdaptive(
        limit: 5000
        filter: { datetime_geq: $since, datetime_leq: $until }
      ) {
        datetime
        ruleId
        source
        action
      }
    }
  }
}`;

interface ZoneBatchResponse {
  viewer: {
    zones: Array<{
      zoneTag: string;
      httpRequests1hGroups: Array<{
        dimensions: { datetime: string };
        sum: {
          requests: number;
          bytes: number;
          cachedBytes: number;
          threats: number;
          countryMap: Array<{ clientCountryName: string | null; requests: number }>;
          responseStatusMap: Array<{ edgeResponseStatus: number | null; requests: number }>;
          clientHTTPVersionMap: Array<{ clientHTTPProtocol: string | null; requests: number }>;
          clientSSLMap: Array<{ clientSSLProtocol: string | null; requests: number }>;
        };
        avg: { sampleInterval: number };
      }>;
    }>;
  };
}

export interface FirewallEventsResponse {
  viewer: {
    zones: Array<{
      zoneTag: string;
      firewallEventsAdaptive: Array<{
        datetime: string;
        ruleId: string | null;
        source: string | null;
        action: string | null;
      }>;
    }>;
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BackfillResult {
  rowsUpserted: number;
  zonesQueried: number;
  windowStart: string;
  windowEnd: string;
}

type CountryDimensionRow = typeof analyticsZoneCountryHourly.$inferInsert;
type StatusDimensionRow = typeof analyticsZoneStatusHourly.$inferInsert;
type HttpVersionDimensionRow = typeof analyticsZoneHttpVersionHourly.$inferInsert;
type SslVersionDimensionRow = typeof analyticsZoneSslVersionHourly.$inferInsert;
type FirewallDimensionRow = typeof analyticsZoneFirewallHourly.$inferInsert;

/**
 * Fetch analytics from Cloudflare GraphQL and upsert into D1.
 *
 * Called by the scheduled() handler (Cron Trigger) and by POST /api/analytics/refresh.
 * Idempotent: running it twice with overlapping windows just re-upserts the same buckets.
 *
 * Rate-limit budget: one GraphQL call per 10-zone chunk. For a 100-zone account
 * that's 10 calls per cron run — well under CF's 300/5-min ceiling.
 */
export async function runAnalyticsBackfill(env: Bindings): Promise<BackfillResult> {
  const db = createDb(env.DB);
  const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
  const startedAt = new Date().toISOString();
  const ownerId = `worker-${crypto.randomUUID()}`;

  try {
    const lock = await acquireBackfillLock(db, ownerId);
    if (!lock.acquired) {
      await logRun(db, startedAt, 0, "partial", "Analytics backfill already running");
      return {
        rowsUpserted: 0,
        zonesQueried: 0,
        windowStart: startedAt,
        windowEnd: startedAt,
      };
    }

    const { since, until } = await computeWindow(db);
    const zones = await cf.listZones();
    const zoneTags = zones.map((z) => z.id);

    if (zoneTags.length === 0) {
      await releaseBackfillLock(db, ownerId);
      await logRun(db, startedAt, 0, "success", null);
      return { rowsUpserted: 0, zonesQueried: 0, windowStart: since, windowEnd: until };
    }

    const zoneChunks = chunk(zoneTags, ZONE_CHUNK_SIZE);
    const timeWindows = splitGraphQLWindows(since, until);

    // Run chunks in parallel — the CloudflareClient ConcurrencyQueue caps at 4.
    const chunkResults = await Promise.all(
      zoneChunks.flatMap((tags) =>
        timeWindows.map((window) =>
          cf.graphql<ZoneBatchResponse>(ZONE_BATCH_QUERY, {
            zoneTags: tags,
            since: window.since,
            until: window.until,
          }),
        ),
      ),
    );

    const hourlyRows = chunkResults.flatMap((data) =>
      data.viewer.zones.flatMap((zone) =>
        zone.httpRequests1hGroups.map((bucket) => ({
          zoneId: zone.zoneTag,
          hourBucket: bucket.dimensions.datetime,
          requests: bucket.sum.requests,
          bytes: bucket.sum.bytes,
          cachedBytes: bucket.sum.cachedBytes,
          threats: bucket.sum.threats,
          sampleInterval: bucket.avg.sampleInterval,
        })),
      ),
    );

    const countryRows = chunkResults.flatMap((data) =>
      data.viewer.zones.flatMap((zone) =>
        zone.httpRequests1hGroups.flatMap((bucket) =>
          bucket.sum.countryMap
            .slice()
            .sort((a, b) => b.requests - a.requests)
            .slice(0, COUNTRY_TOP_N_PER_BUCKET)
            .map((entry) => ({
              zoneId: zone.zoneTag,
              hourBucket: bucket.dimensions.datetime,
              countryCode: normalizeCountryCode(entry.clientCountryName),
              requests: entry.requests,
            })),
        ),
      ),
    );

    const statusRows = chunkResults.flatMap((data) =>
      data.viewer.zones.flatMap((zone) =>
        zone.httpRequests1hGroups.flatMap((bucket) =>
          bucket.sum.responseStatusMap.map((entry) => ({
            zoneId: zone.zoneTag,
            hourBucket: bucket.dimensions.datetime,
            statusCode: entry.edgeResponseStatus ?? 0,
            requests: entry.requests,
          })),
        ),
      ),
    );

    const httpVersionRows = chunkResults.flatMap((data) =>
      data.viewer.zones.flatMap((zone) =>
        zone.httpRequests1hGroups.flatMap((bucket) =>
          bucket.sum.clientHTTPVersionMap.map((entry) => ({
            zoneId: zone.zoneTag,
            hourBucket: bucket.dimensions.datetime,
            httpVersion: normalizeTextDimension(entry.clientHTTPProtocol, "unknown"),
            requests: entry.requests,
          })),
        ),
      ),
    );

    const sslVersionRows = chunkResults.flatMap((data) =>
      data.viewer.zones.flatMap((zone) =>
        zone.httpRequests1hGroups.flatMap((bucket) =>
          bucket.sum.clientSSLMap.map((entry) => ({
            zoneId: zone.zoneTag,
            hourBucket: bucket.dimensions.datetime,
            sslVersion: normalizeTextDimension(entry.clientSSLProtocol, "none"),
            requests: entry.requests,
          })),
        ),
      ),
    );

    const firewallWindows = splitFirewallWindows(since, until);
    const firewallResults = await Promise.allSettled(
      zoneTags.flatMap((zoneTag) =>
        firewallWindows.map((window) =>
          cf.graphql<FirewallEventsResponse>(FIREWALL_EVENTS_QUERY, {
            zoneTag,
            since: window.since,
            until: window.until,
          }),
        ),
      ),
    );

    const firewallRows = aggregateFirewallRows(
      firewallResults.flatMap((result) => {
        if (result.status === "rejected") return [];
        return result.value.viewer.zones.flatMap((zone) =>
          zone.firewallEventsAdaptive.map((event) => ({ zoneId: zone.zoneTag, ...event })),
        );
      }),
    );

    if (hourlyRows.length > 0) {
      for (const slice of chunk(hourlyRows, UPSERT_CHUNK_SIZE)) {
        await db
          .insert(analyticsZoneHourly)
          .values(slice)
          .onConflictDoUpdate({
            target: [analyticsZoneHourly.zoneId, analyticsZoneHourly.hourBucket],
            set: {
              requests: sql`excluded.requests`,
              bytes: sql`excluded.bytes`,
              cachedBytes: sql`excluded.cached_bytes`,
              threats: sql`excluded.threats`,
              sampleInterval: sql`excluded.sample_interval`,
              fetchedAt: sql`datetime('now')`,
            },
          });
      }
    }

    await upsertCountryRows(db, countryRows);
    await upsertStatusRows(db, statusRows);
    await upsertHttpVersionRows(db, httpVersionRows);
    await upsertSslVersionRows(db, sslVersionRows);
    await upsertFirewallRows(db, firewallRows);
    await pruneDimensionRows(db);

    const rowsUpserted =
      hourlyRows.length +
      countryRows.length +
      statusRows.length +
      httpVersionRows.length +
      sslVersionRows.length +
      firewallRows.length;

    await releaseBackfillLock(db, ownerId);
    await logRun(db, startedAt, rowsUpserted, "success", null);
    return {
      rowsUpserted,
      zonesQueried: zones.length,
      windowStart: since,
      windowEnd: until,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await releaseBackfillLock(db, ownerId).catch(() => undefined);
    await logRun(db, startedAt, 0, "error", msg);
    throw err;
  }
}

async function upsertCountryRows(
  db: ReturnType<typeof createDb>,
  rows: CountryDimensionRow[],
): Promise<void> {
  for (const slice of chunk(rows, UPSERT_CHUNK_SIZE)) {
    await db.insert(analyticsZoneCountryHourly).values(slice).onConflictDoUpdate({
      target: [
        analyticsZoneCountryHourly.zoneId,
        analyticsZoneCountryHourly.hourBucket,
        analyticsZoneCountryHourly.countryCode,
      ],
      set: { requests: sql`excluded.requests`, fetchedAt: sql`datetime('now')` },
    });
  }
}

async function upsertStatusRows(
  db: ReturnType<typeof createDb>,
  rows: StatusDimensionRow[],
): Promise<void> {
  for (const slice of chunk(rows, UPSERT_CHUNK_SIZE)) {
    await db.insert(analyticsZoneStatusHourly).values(slice).onConflictDoUpdate({
      target: [
        analyticsZoneStatusHourly.zoneId,
        analyticsZoneStatusHourly.hourBucket,
        analyticsZoneStatusHourly.statusCode,
      ],
      set: { requests: sql`excluded.requests`, fetchedAt: sql`datetime('now')` },
    });
  }
}

async function upsertHttpVersionRows(
  db: ReturnType<typeof createDb>,
  rows: HttpVersionDimensionRow[],
): Promise<void> {
  for (const slice of chunk(rows, UPSERT_CHUNK_SIZE)) {
    await db.insert(analyticsZoneHttpVersionHourly).values(slice).onConflictDoUpdate({
      target: [
        analyticsZoneHttpVersionHourly.zoneId,
        analyticsZoneHttpVersionHourly.hourBucket,
        analyticsZoneHttpVersionHourly.httpVersion,
      ],
      set: { requests: sql`excluded.requests`, fetchedAt: sql`datetime('now')` },
    });
  }
}

async function upsertSslVersionRows(
  db: ReturnType<typeof createDb>,
  rows: SslVersionDimensionRow[],
): Promise<void> {
  for (const slice of chunk(rows, UPSERT_CHUNK_SIZE)) {
    await db.insert(analyticsZoneSslVersionHourly).values(slice).onConflictDoUpdate({
      target: [
        analyticsZoneSslVersionHourly.zoneId,
        analyticsZoneSslVersionHourly.hourBucket,
        analyticsZoneSslVersionHourly.sslVersion,
      ],
      set: { requests: sql`excluded.requests`, fetchedAt: sql`datetime('now')` },
    });
  }
}

async function upsertFirewallRows(
  db: ReturnType<typeof createDb>,
  rows: FirewallDimensionRow[],
): Promise<void> {
  for (const slice of chunk(rows, UPSERT_CHUNK_SIZE)) {
    await db.insert(analyticsZoneFirewallHourly).values(slice).onConflictDoUpdate({
      target: [
        analyticsZoneFirewallHourly.zoneId,
        analyticsZoneFirewallHourly.hourBucket,
        analyticsZoneFirewallHourly.ruleId,
        analyticsZoneFirewallHourly.source,
        analyticsZoneFirewallHourly.action,
      ],
      set: { events: sql`excluded.events`, fetchedAt: sql`datetime('now')` },
    });
  }
}

async function pruneDimensionRows(db: ReturnType<typeof createDb>): Promise<void> {
  const cutoff = new Date(Date.now() - DIMENSION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.delete(analyticsZoneCountryHourly).where(lt(analyticsZoneCountryHourly.hourBucket, cutoff));
  await db.delete(analyticsZoneStatusHourly).where(lt(analyticsZoneStatusHourly.hourBucket, cutoff));
  await db
    .delete(analyticsZoneHttpVersionHourly)
    .where(lt(analyticsZoneHttpVersionHourly.hourBucket, cutoff));
  await db
    .delete(analyticsZoneSslVersionHourly)
    .where(lt(analyticsZoneSslVersionHourly.hourBucket, cutoff));
  await db.delete(analyticsZoneFirewallHourly).where(lt(analyticsZoneFirewallHourly.hourBucket, cutoff));
}

function aggregateFirewallRows(
  events: Array<{
    zoneId: string;
    datetime: string;
    ruleId: string | null;
    source: string | null;
    action: string | null;
  }>,
): FirewallDimensionRow[] {
  const counts = new Map<string, FirewallDimensionRow>();

  for (const event of events) {
    const hourBucket = `${event.datetime.slice(0, 13)}:00:00Z`;
    const ruleId = normalizeTextDimension(event.ruleId, "unknown");
    const source = normalizeTextDimension(event.source, "unknown");
    const action = normalizeTextDimension(event.action, "unknown");
    const key = [event.zoneId, hourBucket, ruleId, source, action].join("\u0000");
    const existing = counts.get(key);
    if (existing) {
      existing.events = (existing.events ?? 0) + 1;
    } else {
      counts.set(key, { zoneId: event.zoneId, hourBucket, ruleId, source, action, events: 1 });
    }
  }

  return [...counts.values()];
}

function normalizeCountryCode(value: string | null): string {
  const normalized = normalizeTextDimension(value, "XX").toUpperCase();
  return normalized.length === 2 ? normalized : "XX";
}

function normalizeTextDimension(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

async function acquireBackfillLock(
  db: ReturnType<typeof createDb>,
  ownerId: string,
): Promise<{ acquired: boolean }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + BACKFILL_LOCK_TTL_MS).toISOString();
  const nowIso = now.toISOString();

  const rows = await db
    .insert(analyticsLocks)
    .values({
      name: BACKFILL_LOCK_NAME,
      ownerId,
      expiresAt,
      updatedAt: nowIso,
    })
    .onConflictDoUpdate({
      target: analyticsLocks.name,
      set: {
        ownerId,
        expiresAt,
        updatedAt: nowIso,
      },
      where: lt(analyticsLocks.expiresAt, nowIso),
    })
    .returning({ name: analyticsLocks.name });

  return { acquired: rows.length > 0 };
}

async function releaseBackfillLock(
  db: ReturnType<typeof createDb>,
  ownerId: string,
): Promise<void> {
  await db
    .delete(analyticsLocks)
    .where(and(eq(analyticsLocks.name, BACKFILL_LOCK_NAME), eq(analyticsLocks.ownerId, ownerId)));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function computeWindow(
  db: ReturnType<typeof createDb>,
): Promise<{ since: string; until: string }> {
  const now = new Date();

  const lastSuccess = await db
    .select()
    .from(analyticsSyncLog)
    .where(eq(analyticsSyncLog.status, "success"))
    .orderBy(desc(analyticsSyncLog.finishedAt))
    .limit(1);

  const window = resolveBackfillWindow(
    now,
    lastSuccess[0]?.finishedAt ?? null,
  );
  const dimensionBootstrapSince = await getDimensionBootstrapSince(db, now);

  if (dimensionBootstrapSince && Date.parse(dimensionBootstrapSince) < Date.parse(window.since)) {
    return { since: dimensionBootstrapSince, until: window.until };
  }

  return window;
}

async function getDimensionBootstrapSince(
  db: ReturnType<typeof createDb>,
  now: Date,
): Promise<string | null> {
  const safeSince = new Date(now);
  safeSince.setHours(safeSince.getHours() - MAX_GRAPHQL_LOOKBACK_HOURS);
  const safeSinceIso = safeSince.toISOString();

  const [country] = await db
    .select({ oldest: sql<string | null>`MIN(${analyticsZoneCountryHourly.hourBucket})` })
    .from(analyticsZoneCountryHourly);
  const [status] = await db
    .select({ oldest: sql<string | null>`MIN(${analyticsZoneStatusHourly.hourBucket})` })
    .from(analyticsZoneStatusHourly);
  const [http] = await db
    .select({ oldest: sql<string | null>`MIN(${analyticsZoneHttpVersionHourly.hourBucket})` })
    .from(analyticsZoneHttpVersionHourly);
  const [ssl] = await db
    .select({ oldest: sql<string | null>`MIN(${analyticsZoneSslVersionHourly.hourBucket})` })
    .from(analyticsZoneSslVersionHourly);

  const oldestBuckets = [country?.oldest, status?.oldest, http?.oldest, ssl?.oldest];
  for (const bucket of oldestBuckets) {
    if (!bucket || Date.parse(bucket) > Date.parse(safeSinceIso)) return safeSinceIso;
  }

  return null;
}

export function resolveBackfillWindow(
  now: Date,
  lastSuccessFinishedAt: string | null,
): { since: string; until: string } {
  const until = now.toISOString();
  const safeSince = new Date(now);
  safeSince.setHours(safeSince.getHours() - MAX_GRAPHQL_LOOKBACK_HOURS);

  if (lastSuccessFinishedAt) {
    const last = new Date(lastSuccessFinishedAt);
    last.setHours(last.getHours() - OVERLAP_HOURS);
    return {
      since: new Date(Math.max(last.getTime(), safeSince.getTime())).toISOString(),
      until,
    };
  }

  return { since: safeSince.toISOString(), until };
}

export function splitGraphQLWindows(
  since: string,
  until: string,
): Array<{ since: string; until: string }> {
  const windows: Array<{ since: string; until: string }> = [];
  const maxSpanMs = MAX_GRAPHQL_WINDOW_HOURS * 60 * 60 * 1000;

  let cursor = new Date(since).getTime();
  const end = new Date(until).getTime();

  while (cursor <= end) {
    const windowEnd = Math.min(cursor + maxSpanMs - 1, end);
    windows.push({
      since: new Date(cursor).toISOString(),
      until: new Date(windowEnd).toISOString(),
    });
    cursor = windowEnd + 1;
  }

  return windows;
}

export function splitFirewallWindows(
  since: string,
  until: string,
): Array<{ since: string; until: string }> {
  const windows: Array<{ since: string; until: string }> = [];
  const maxSpanMs = MAX_FIREWALL_WINDOW_HOURS * 60 * 60 * 1000;

  let cursor = new Date(since).getTime();
  const end = new Date(until).getTime();

  while (cursor <= end) {
    const windowEnd = Math.min(cursor + maxSpanMs - 1, end);
    windows.push({
      since: new Date(cursor).toISOString(),
      until: new Date(windowEnd).toISOString(),
    });
    cursor = windowEnd + 1;
  }

  return windows;
}

async function logRun(
  db: ReturnType<typeof createDb>,
  startedAt: string,
  rowsUpserted: number,
  status: "success" | "partial" | "error",
  error: string | null,
): Promise<void> {
  await db.insert(analyticsSyncLog).values({
    startedAt,
    finishedAt: new Date().toISOString(),
    rowsUpserted,
    status,
    error,
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
