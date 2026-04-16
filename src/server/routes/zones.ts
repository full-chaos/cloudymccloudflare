import { Hono } from "hono";
import { eq, inArray } from "drizzle-orm";
import type { Bindings } from "../types/env";
import { CloudflareClient } from "../services/cloudflare";
import { createDb, zoneCache } from "../db";
import { updateZoneSettingSchema } from "@shared/validators";
import { zValidator } from "../utils/zvalidator";
import type { Zone } from "@shared/types";

const zones = new Hono<{ Bindings: Bindings }>();

// GET /api/zones - list all zones (from CF API, cached in D1)
zones.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  // Try to serve from cache first (only if cache is recent enough)
  const cachedZones = await db.select().from(zoneCache).orderBy(zoneCache.name);

  // Use cache if it has data and is less than 5 minutes old
  if (cachedZones.length > 0) {
    const oldestSync = cachedZones.reduce((min, z) => {
      const t = new Date(z.syncedAt).getTime();
      return t < min ? t : min;
    }, Infinity);

    const ageMs = Date.now() - oldestSync;
    if (ageMs < 5 * 60 * 1000) {
      const result: Zone[] = cachedZones.map((z) => ({
        id: z.id,
        name: z.name,
        status: z.status,
        paused: z.paused,
        plan: {
          id: "",
          name: z.planName,
          price: z.planPrice,
        },
        nameServers: JSON.parse(z.nameServers) as string[],
      }));

      return c.json({ success: true, result });
    }
  }

  // Fetch fresh from CF API and update cache
  const cfZones = await cf.listZones();

  // Upsert into zone cache (non-blocking — don't fail the response if cache write fails)
  try {
    await syncZoneCache(db, cachedZones.map((zone) => zone.id), cfZones);
  } catch {
    // Cache write failed — still return the fresh API data
    console.warn("Failed to update zone cache in D1");
  }

  const result: Zone[] = cfZones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    status: zone.status,
    paused: zone.paused,
    plan: {
      id: zone.plan?.id ?? "",
      name: zone.plan?.name ?? "",
      price: zone.plan?.price ?? 0,
    },
    nameServers: zone.name_servers ?? [],
  }));

  return c.json({ success: true, result });
});

// GET /api/zones/:zoneId - zone detail
zones.get("/:zoneId", async (c) => {
  const { zoneId } = c.req.param();
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  const zone = await cf.getZone(zoneId);

  return c.json({
    success: true,
    result: {
      id: zone.id,
      name: zone.name,
      status: zone.status,
      paused: zone.paused,
      plan: {
        id: zone.plan?.id ?? "",
        name: zone.plan?.name ?? "",
        price: zone.plan?.price ?? 0,
      },
      nameServers: zone.name_servers ?? [],
    } satisfies Zone,
  });
});

// GET /api/zones/:zoneId/settings - zone settings
zones.get("/:zoneId/settings", async (c) => {
  const { zoneId } = c.req.param();
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  const settings = await cf.getZoneSettings(zoneId);

  return c.json({ success: true, result: settings });
});

// PATCH /api/zones/:zoneId/settings - update zone setting
zones.patch(
  "/:zoneId/settings",
  zValidator(updateZoneSettingSchema),
  async (c) => {
    const { zoneId } = c.req.param();
    const body = c.req.valid("json");
    const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

    const updated = await cf.updateZoneSetting(zoneId, body.id, body.value);

    return c.json({ success: true, result: updated });
  }
);

// POST /api/zones/sync - force re-sync zone cache
zones.post("/sync", async (c) => {
  const db = createDb(c.env.DB);
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  const cfZones = await cf.listZones();
  const cachedZones = await db.select({ id: zoneCache.id }).from(zoneCache);
  const now = await syncZoneCache(db, cachedZones.map((zone) => zone.id), cfZones);

  return c.json({
    success: true,
    result: {
      synced: cfZones.length,
      syncedAt: now,
    },
  });
});

async function syncZoneCache(
  db: ReturnType<typeof createDb>,
  cachedZoneIds: string[],
  cfZones: Awaited<ReturnType<CloudflareClient["listZones"]>>,
): Promise<string> {
  const now = new Date().toISOString();
  const liveZoneIds = new Set(cfZones.map((zone) => zone.id));
  const staleZoneIds = cachedZoneIds.filter((zoneId) => !liveZoneIds.has(zoneId));

  if (staleZoneIds.length > 0) {
    await db.delete(zoneCache).where(inArray(zoneCache.id, staleZoneIds));
  }

  for (const zone of cfZones) {
    const payload = {
      name: zone.name,
      status: zone.status,
      paused: zone.paused,
      planName: zone.plan?.name ?? "",
      planPrice: zone.plan?.price ?? 0,
      nameServers: JSON.stringify(zone.name_servers ?? []),
      accountId: zone.account?.id ?? "",
      rawJson: JSON.stringify(zone),
      syncedAt: now,
    };

    if (cachedZoneIds.includes(zone.id)) {
      await db.update(zoneCache).set(payload).where(eq(zoneCache.id, zone.id));
    } else {
      await db.insert(zoneCache).values({
        id: zone.id,
        ...payload,
      });
    }
  }

  return now;
}

export default zones;
