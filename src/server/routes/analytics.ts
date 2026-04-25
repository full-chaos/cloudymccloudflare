import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Bindings } from "../types/env";
import { createDb } from "../db";
import { analyticsQuerySchema } from "@shared/validators";
import { zValidatorQuery } from "../utils/zvalidator";
import {
  getAccountAnalytics,
  getAnalyticsStatus,
  getClusterAnalytics,
  getGroupAnalytics,
  getZoneAnalytics,
} from "../services/analytics.service";
import { runAnalyticsBackfill } from "../services/analytics-backfill.service";

const analytics = new Hono<{ Bindings: Bindings }>();

const rangeQueryValidator = zValidatorQuery(analyticsQuerySchema);

// ─── GET /api/analytics/account?range=24h|7d|30d ─────────────────────────────

analytics.get("/account", rangeQueryValidator, async (c) => {
  const { range } = c.req.valid("query");
  const db = createDb(c.env.DB);
  const result = await getAccountAnalytics(db, range);
  return c.json({ success: true, result });
});

// ─── GET /api/analytics/group/:groupId?range=... ─────────────────────────────

analytics.get("/group/:groupId", rangeQueryValidator, async (c) => {
  const { range } = c.req.valid("query");
  const { groupId } = c.req.param();
  const db = createDb(c.env.DB);
  const result = await getGroupAnalytics(db, groupId, range);
  if (!result) {
    throw new HTTPException(404, { message: `Group ${groupId} not found` });
  }
  return c.json({ success: true, result });
});

// ─── GET /api/analytics/cluster/:name?range=... ───────────────────────────────

analytics.get("/cluster/:name", rangeQueryValidator, async (c) => {
  const { range } = c.req.valid("query");
  const { name } = c.req.param();
  const db = createDb(c.env.DB);
  const result = await getClusterAnalytics(db, name, range);
  if (!result) {
    throw new HTTPException(404, { message: `Cluster ${name} not found` });
  }
  return c.json({ success: true, result });
});

// ─── GET /api/analytics/zone/:zoneId?range=... ───────────────────────────────

analytics.get("/zone/:zoneId", rangeQueryValidator, async (c) => {
  const { range } = c.req.valid("query");
  const { zoneId } = c.req.param();
  const db = createDb(c.env.DB);
  const result = await getZoneAnalytics(db, zoneId, range);
  return c.json({ success: true, result });
});

// ─── GET /api/analytics/status ───────────────────────────────────────────────

analytics.get("/status", async (c) => {
  const db = createDb(c.env.DB);
  const result = await getAnalyticsStatus(db);
  return c.json({ success: true, result });
});

// ─── POST /api/analytics/refresh ─────────────────────────────────────────────
// Manual backfill trigger. Same code path as the scheduled cron.

analytics.post("/refresh", async (c) => {
  try {
    const result = await runAnalyticsBackfill(c.env);
    return c.json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HTTPException(500, { message: `Backfill failed: ${msg}` });
  }
});

export default analytics;
