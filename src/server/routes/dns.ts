import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import type { Bindings } from "../types/env";
import { CloudflareClient } from "../services/cloudflare";
import { createDb, groupZones } from "../db";
import {
  createDNSRecordSchema,
  updateDNSRecordSchema,
  batchApplyDNSSchema,
  batchApplyDNSByGroupSchema,
} from "@shared/validators";
import {
  getDNSRecords,
  createRecord,
  updateRecord,
  deleteRecord,
  batchApplyRecords,
} from "../services/dns.service";
import { zValidator } from "../utils/zvalidator";

const dns = new Hono<{ Bindings: Bindings }>();

// GET /api/dns/:zoneId - list records
dns.get("/:zoneId", async (c) => {
  const { zoneId } = c.req.param();
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  const records = await getDNSRecords(cf, zoneId);

  return c.json({ success: true, result: records });
});

// POST /api/dns/:zoneId - create record
dns.post("/:zoneId", zValidator(createDNSRecordSchema), async (c) => {
  const { zoneId } = c.req.param();
  const data = c.req.valid("json");
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  const record = await createRecord(cf, zoneId, data);

  return c.json({ success: true, result: record }, 201);
});

// PATCH /api/dns/:zoneId/:recordId - update record
dns.patch("/:zoneId/:recordId", zValidator(updateDNSRecordSchema), async (c) => {
  const { zoneId, recordId } = c.req.param();
  const data = c.req.valid("json");
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  const record = await updateRecord(cf, zoneId, recordId, data);

  return c.json({ success: true, result: record });
});

// DELETE /api/dns/:zoneId/:recordId - delete record
dns.delete("/:zoneId/:recordId", async (c) => {
  const { zoneId, recordId } = c.req.param();
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  await deleteRecord(cf, zoneId, recordId);

  return c.json({ success: true, result: { deleted: true } });
});

// POST /api/dns/batch - batch apply to multiple zones
dns.post("/batch", zValidator(batchApplyDNSSchema), async (c) => {
  const { zoneIds, records } = c.req.valid("json");
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  const results = await batchApplyRecords(cf, zoneIds, {
    posts: records.posts,
    patches: records.patches,
    deletes: records.deletes,
  });

  return c.json({ success: true, result: results });
});

// POST /api/dns/batch-by-group - batch apply by group
dns.post("/batch-by-group", zValidator(batchApplyDNSByGroupSchema), async (c) => {
  const { groupId, records } = c.req.valid("json");
  const db = createDb(c.env.DB);
  const cf = new CloudflareClient(c.env.CF_API_TOKEN, c.env.CF_ACCOUNT_ID);

  // Resolve zone IDs from group
  const zoneRows = await db
    .select({ zoneId: groupZones.zoneId })
    .from(groupZones)
    .where(eq(groupZones.groupId, groupId));

  if (zoneRows.length === 0) {
    throw new HTTPException(404, { message: `Group ${groupId} not found or has no zones` });
  }

  const zoneIds = zoneRows.map((z) => z.zoneId);

  const results = await batchApplyRecords(cf, zoneIds, {
    posts: records.posts,
    patches: records.patches,
    deletes: records.deletes,
  });

  return c.json({ success: true, result: results });
});

export default dns;
