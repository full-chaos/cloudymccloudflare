import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Bindings } from "../types/env";
import { createDb } from "../db";
import { ensureAnalyticsSchema } from "../db/ensure-analytics-schema";
import { analyticsRangeSchema } from "@shared/validators";
import {
  getAccountAnalytics,
  getAnalyticsStatus,
  getGroupAnalytics,
  getZoneAnalytics,
} from "../services/analytics.service";
import { runAnalyticsBackfill } from "../services/analytics-backfill.service";

const analytics = new Hono<{ Bindings: Bindings }>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRange(raw: string | undefined) {
  const parsed = analyticsRangeSchema.safeParse(raw ?? "24h");
  if (!parsed.success) {
    throw new HTTPException(400, {
      message: `Invalid range. Expected one of: 24h, 7d, 30d`,
    });
  }
  return parsed.data;
}

// ─── GET /api/analytics/account?range=24h|7d|30d ─────────────────────────────

analytics.get("/account", async (c) => {
  const range = parseRange(c.req.query("range"));
  await ensureAnalyticsSchema(c.env.DB);
  const db = createDb(c.env.DB);
  const result = await getAccountAnalytics(db, range);
  return c.json({ success: true, result });
});

// ─── GET /api/analytics/group/:groupId?range=... ─────────────────────────────

analytics.get("/group/:groupId", async (c) => {
  const range = parseRange(c.req.query("range"));
  const { groupId } = c.req.param();
  await ensureAnalyticsSchema(c.env.DB);
  const db = createDb(c.env.DB);
  const result = await getGroupAnalytics(db, groupId, range);
  if (!result) {
    throw new HTTPException(404, { message: `Group ${groupId} not found` });
  }
  return c.json({ success: true, result });
});

// ─── GET /api/analytics/zone/:zoneId?range=... ───────────────────────────────

analytics.get("/zone/:zoneId", async (c) => {
  const range = parseRange(c.req.query("range"));
  const { zoneId } = c.req.param();
  await ensureAnalyticsSchema(c.env.DB);
  const db = createDb(c.env.DB);
  const result = await getZoneAnalytics(db, zoneId, range);
  return c.json({ success: true, result });
});

// ─── GET /api/analytics/status ───────────────────────────────────────────────

analytics.get("/status", async (c) => {
  await ensureAnalyticsSchema(c.env.DB);
  const db = createDb(c.env.DB);
  const result = await getAnalyticsStatus(db);
  return c.json({ success: true, result });
});

// ─── POST /api/analytics/refresh ─────────────────────────────────────────────
// Manual backfill trigger. Same code path as the scheduled cron.

analytics.post("/refresh", async (c) => {
  try {
    await ensureAnalyticsSchema(c.env.DB);
    const result = await runAnalyticsBackfill(c.env);
    return c.json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HTTPException(500, { message: `Backfill failed: ${msg}` });
  }
});

export default analytics;
