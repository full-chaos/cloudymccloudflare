import { z } from "zod";
import { DNS_RECORD_TYPES } from "./constants";

// ─── DNS Record Schemas ───────────────────────────────────────────────────────

export const createDNSRecordSchema = z.object({
  type: z.enum(DNS_RECORD_TYPES),
  name: z.string().min(1, "Name is required"),
  content: z.string().min(1, "Content is required"),
  ttl: z.number().int().positive().optional(),
  proxied: z.boolean().optional(),
  priority: z.number().int().min(0).max(65535).optional(),
});

export type CreateDNSRecordInput = z.infer<typeof createDNSRecordSchema>;

export const updateDNSRecordSchema = createDNSRecordSchema.partial();

export type UpdateDNSRecordInput = z.infer<typeof updateDNSRecordSchema>;

// ─── Batch DNS Schemas ────────────────────────────────────────────────────────

export const batchDNSOperationsSchema = z.object({
  posts: z.array(createDNSRecordSchema).optional(),
  patches: z
    .array(
      z.object({
        id: z.string().min(1),
        type: z.enum(DNS_RECORD_TYPES).optional(),
        name: z.string().min(1).optional(),
        content: z.string().min(1).optional(),
        ttl: z.number().int().positive().optional(),
        proxied: z.boolean().optional(),
        priority: z.number().int().min(0).max(65535).optional(),
      })
    )
    .optional(),
  deletes: z.array(z.object({ id: z.string().min(1) })).optional(),
});

export type BatchDNSOperationsInput = z.infer<typeof batchDNSOperationsSchema>;

export const batchDNSSchema = z.object({
  zoneIds: z.array(z.string().min(1)).min(1, "At least one zone ID is required"),
  records: z.array(createDNSRecordSchema).min(1, "At least one record is required"),
});

export type BatchDNSInput = z.infer<typeof batchDNSSchema>;

export const batchApplyDNSSchema = z.object({
  zoneIds: z.array(z.string().min(1)).min(1, "At least one zone ID is required"),
  records: batchDNSOperationsSchema,
});

export type BatchApplyDNSInput = z.infer<typeof batchApplyDNSSchema>;

export const batchDNSByGroupSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  records: z.array(createDNSRecordSchema).min(1, "At least one record is required"),
});

export type BatchDNSByGroupInput = z.infer<typeof batchDNSByGroupSchema>;

export const batchApplyDNSByGroupSchema = z.object({
  groupId: z.string().min(1, "Group ID is required"),
  records: batchDNSOperationsSchema,
});

export type BatchApplyDNSByGroupInput = z.infer<typeof batchApplyDNSByGroupSchema>;

// ─── Group Schemas ────────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a valid hex color")
    .optional(),
  description: z.string().max(500).optional(),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const updateGroupSchema = createGroupSchema.partial();

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;

export const addZonesToGroupSchema = z.object({
  zones: z
    .array(
      z.object({
        zoneId: z.string().min(1),
        zoneName: z.string().min(1),
      })
    )
    .min(1, "At least one zone is required"),
});

export type AddZonesToGroupInput = z.infer<typeof addZonesToGroupSchema>;

export const removeZonesFromGroupSchema = z.object({
  zoneIds: z.array(z.string().min(1)).min(1, "At least one zone ID is required"),
});

export type RemoveZonesFromGroupInput = z.infer<typeof removeZonesFromGroupSchema>;

// ─── Firewall Rule Schemas ────────────────────────────────────────────────────

export const ruleActionSchema = z.enum([
  "block",
  "managed_challenge",
  "js_challenge",
  "challenge",
  "skip",
  "log",
]);

export const customRuleSchema = z.object({
  id: z.string().optional(),
  expression: z.string().min(1, "Expression is required"),
  action: ruleActionSchema,
  description: z.string().min(1, "Description is required"),
  enabled: z.boolean().optional().default(true),
});

export type CustomRuleInput = z.infer<typeof customRuleSchema>;

// ─── Replace WAF Rules Schema ─────────────────────────────────────────────────

// Used by PUT /api/security/:zoneId/rules — replaces the entire custom WAF
// ruleset for a zone. An empty `rules` array is allowed and clears the ruleset.
export const replaceWAFRulesSchema = z.object({
  rules: z.array(customRuleSchema),
});

export type ReplaceWAFRulesInput = z.infer<typeof replaceWAFRulesSchema>;

// ─── Deploy Rules Schema ──────────────────────────────────────────────────────

export const deployTargetSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("zones"),
    ids: z.array(z.string().min(1)).min(1, "At least one zone ID is required"),
  }),
  z.object({
    type: z.literal("group"),
    id: z.string().min(1, "Group ID is required"),
  }),
]);

export const deployRulesSchema = z.object({
  target: deployTargetSchema,
  rules: z.array(customRuleSchema).min(1, "At least one rule is required"),
  mode: z.enum(["append", "replace"]),
});

export type DeployRulesInput = z.infer<typeof deployRulesSchema>;

// ─── Zone Settings Schema ─────────────────────────────────────────────────────

export const updateZoneSettingSchema = z.object({
  id: z.string().min(1, "Setting ID is required"),
  value: z.unknown(),
});

export type UpdateZoneSettingInput = z.infer<typeof updateZoneSettingSchema>;

// ─── IP Access Rule Schema ────────────────────────────────────────────────────

export const createIPAccessRuleSchema = z.object({
  mode: z.enum(["block", "challenge", "whitelist", "js_challenge", "managed_challenge"]),
  configuration: z.object({
    target: z.enum(["ip", "ip_range", "asn", "country"]),
    value: z.string().min(1),
  }),
  notes: z.string().max(1000).optional(),
});

export type CreateIPAccessRuleInput = z.infer<typeof createIPAccessRuleSchema>;

// ─── Template Schema ──────────────────────────────────────────────────────────

export const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  expression: z.string().min(1, "Expression is required"),
  action: ruleActionSchema,
  category: z.string().max(50).optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  expression: z.string().min(1).optional(),
  action: ruleActionSchema.optional(),
  category: z.string().max(50).nullable().optional(),
});

export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;

// ─── Analytics Schema ─────────────────────────────────────────────────────────

export const analyticsRangeSchema = z.enum(["24h", "7d", "30d"]);

export type AnalyticsRangeInput = z.infer<typeof analyticsRangeSchema>;

export const analyticsQuerySchema = z.object({
  range: analyticsRangeSchema.optional().default("24h"),
});

export type AnalyticsQueryInput = z.infer<typeof analyticsQuerySchema>;

// ─── Route Param / Query Schemas ──────────────────────────────────────────────

const nonEmptyId = z.string().min(1);

export const zoneParamSchema = z.object({ zoneId: nonEmptyId });
export const groupParamSchema = z.object({ groupId: nonEmptyId });
export const dnsRecordParamSchema = z.object({ zoneId: nonEmptyId, recordId: nonEmptyId });
export const wafRuleParamSchema = z.object({ zoneId: nonEmptyId, ruleId: nonEmptyId });
export const templateParamSchema = z.object({ id: nonEmptyId });

export const deploymentLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});
