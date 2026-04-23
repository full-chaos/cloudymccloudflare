import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq, inArray } from "drizzle-orm";
import type { Bindings } from "../types/env";
import { createCloudflareClient } from "../services/cloudflare";
import { createDb, groupZones, zoneCache } from "../db";
import {
  customRuleSchema,
  deployRulesSchema,
  createIPAccessRuleSchema,
  replaceWAFRulesSchema,
} from "@shared/validators";
import {
  getWAFRules,
  deployRules,
  getDeploymentLog,
} from "../services/security.service";
import { zValidator } from "../utils/zvalidator";
import type { CFRule } from "../types/cloudflare";

const security = new Hono<{ Bindings: Bindings }>();

// GET /api/security/:zoneId/rules - get WAF rules for a zone
security.get("/:zoneId/rules", async (c) => {
  const { zoneId } = c.req.param();
  const cf = createCloudflareClient(c.env);

  const ruleset = await getWAFRules(cf, zoneId);

  return c.json({ success: true, result: ruleset });
});

// POST /api/security/:zoneId/rules - add a single rule to zone
security.post("/:zoneId/rules", zValidator(customRuleSchema), async (c) => {
  const { zoneId } = c.req.param();
  const rule = c.req.valid("json");
  const cf = createCloudflareClient(c.env);

  // Get existing ruleset and append
  const existing = await cf.getCustomWAFRules(zoneId);
  const newRule: CFRule = {
    action: rule.action,
    expression: rule.expression,
    description: rule.description,
    enabled: rule.enabled ?? true,
  };

  const updated = await cf.setCustomWAFRules(zoneId, [...existing.rules, newRule]);

  return c.json({ success: true, result: updated }, 201);
});

// PUT /api/security/:zoneId/rules - replace all rules for a zone
security.put("/:zoneId/rules", zValidator(replaceWAFRulesSchema), async (c) => {
  const { zoneId } = c.req.param();
  const { rules } = c.req.valid("json");
  const cf = createCloudflareClient(c.env);

  const cfRules: CFRule[] = rules.map((r) => ({
    id: r.id,
    action: r.action,
    expression: r.expression,
    description: r.description,
    enabled: r.enabled,
  }));

  const updated = await cf.setCustomWAFRules(zoneId, cfRules);

  return c.json({ success: true, result: updated });
});

// DELETE /api/security/:zoneId/rules/:ruleId - delete a specific rule
security.delete("/:zoneId/rules/:ruleId", async (c) => {
  const { zoneId, ruleId } = c.req.param();
  const cf = createCloudflareClient(c.env);

  const existing = await cf.getCustomWAFRules(zoneId);
  const filtered = existing.rules.filter((r) => r.id !== ruleId);

  if (filtered.length === existing.rules.length) {
    throw new HTTPException(404, { message: `Rule ${ruleId} not found` });
  }

  const updated = await cf.setCustomWAFRules(zoneId, filtered);

  return c.json({ success: true, result: updated });
});

// POST /api/security/deploy - deploy rules to target zones/group
security.post("/deploy", zValidator(deployRulesSchema), async (c) => {
  // TODO: Align this response contract with the client log model. The UI
  // currently expects per-rule deployment log entries, but this route returns
  // per-zone deploy results.
  const { target, rules, mode } = c.req.valid("json");
  const db = createDb(c.env.DB);
  const cf = createCloudflareClient(c.env);

  let zoneIds: string[] = [];
  const zoneNameMap: Record<string, string> = {};

  if (target.type === "zones") {
    zoneIds = target.ids;

    const cachedZones = await db
      .select({ id: zoneCache.id, name: zoneCache.name })
      .from(zoneCache)
      .where(inArray(zoneCache.id, zoneIds));

    for (const zone of cachedZones) {
      zoneNameMap[zone.id] = zone.name;
    }
  } else if (target.type === "group") {
    const groupId = target.ids[0];

    const zoneRows = await db
      .select({ zoneId: groupZones.zoneId, zoneName: groupZones.zoneName })
      .from(groupZones)
      .where(eq(groupZones.groupId, groupId));

    if (zoneRows.length === 0) {
      throw new HTTPException(404, {
        message: `Group ${groupId} not found or has no zones`,
      });
    }

    zoneIds = zoneRows.map((z) => z.zoneId);
    for (const z of zoneRows) {
      zoneNameMap[z.zoneId] = z.zoneName;
    }
  }

  if (zoneIds.length === 0) {
    throw new HTTPException(400, { message: "No zones to deploy to" });
  }

  // Normalize enabled field (default to true if undefined)
  const normalizedRules = rules.map((r) => ({
    ...r,
    enabled: r.enabled ?? true,
  }));

  const results = await deployRules(
    cf,
    db,
    { type: "zones", ids: zoneIds },
    normalizedRules,
    mode,
    zoneNameMap
  );

  return c.json({ success: true, result: results });
});

// GET /api/security/deployments - deployment log
security.get("/deployments", async (c) => {
  const db = createDb(c.env.DB);
  const limitParam = c.req.query("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;

  const result = await getDeploymentLog(db, limit);

  return c.json({ success: true, result });
});

// GET /api/security/ip-rules/:zoneId - IP access rules
security.get("/ip-rules/:zoneId", async (c) => {
  const { zoneId } = c.req.param();
  const cf = createCloudflareClient(c.env);

  const rules = await cf.listIPAccessRules(zoneId);

  return c.json({ success: true, result: rules });
});

// POST /api/security/ip-rules/:zoneId - create IP access rule
security.post("/ip-rules/:zoneId", zValidator(createIPAccessRuleSchema), async (c) => {
  const { zoneId } = c.req.param();
  const data = c.req.valid("json");
  const cf = createCloudflareClient(c.env);

  const rule = await cf.createIPAccessRule(zoneId, {
    mode: data.mode,
    configuration: data.configuration,
    notes: data.notes,
  });

  return c.json({ success: true, result: rule }, 201);
});

export default security;
