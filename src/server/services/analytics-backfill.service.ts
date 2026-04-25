import { and, desc, eq, lt, sql } from "drizzle-orm";
import type { Bindings } from "../types/env";
import { createDb } from "../db";
import { analyticsZoneHourly, analyticsSyncLog, analyticsLocks } from "../db/schema";
import { CloudflareClient } from "./cloudflare";

// ─── Configuration ────────────────────────────────────────────────────────────

/** Cloudflare GraphQL allows up to 10 zones per `zoneTag_in` filter. */
const ZONE_CHUNK_SIZE = 10;

/** Cloudflare GraphQL analytics rejects per-zone ranges wider than 3 days. */
const MAX_GRAPHQL_WINDOW_HOURS = 24 * 3;

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

// ─── Public API ───────────────────────────────────────────────────────────────

export interface BackfillResult {
  rowsUpserted: number;
  zonesQueried: number;
  windowStart: string;
  windowEnd: string;
}

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

    const rows = chunkResults.flatMap((data) =>
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

    if (rows.length > 0) {
      for (const slice of chunk(rows, UPSERT_CHUNK_SIZE)) {
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

    await releaseBackfillLock(db, ownerId);
    await logRun(db, startedAt, rows.length, "success", null);
    return {
      rowsUpserted: rows.length,
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

  return resolveBackfillWindow(
    now,
    lastSuccess[0]?.finishedAt ?? null,
  );
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
