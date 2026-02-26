import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Groups ───────────────────────────────────────────────────────────────────

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  description: text("description"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type Group = typeof groups.$inferSelect;
export type NewGroup = typeof groups.$inferInsert;

// ─── Group Zones ──────────────────────────────────────────────────────────────

export const groupZones = sqliteTable("group_zones", {
  id: text("id").primaryKey(),
  groupId: text("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  zoneId: text("zone_id").notNull(),
  zoneName: text("zone_name").notNull(),
  addedAt: text("added_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type GroupZone = typeof groupZones.$inferSelect;
export type NewGroupZone = typeof groupZones.$inferInsert;

// ─── Custom Templates ──────────────────────────────────────────────────────────

export const customTemplates = sqliteTable("custom_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  expression: text("expression").notNull(),
  action: text("action").notNull(),
  category: text("category"),
  rulesJson: text("rules_json"), // JSON array of rule objects for multi-rule templates
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type CustomTemplate = typeof customTemplates.$inferSelect;
export type NewCustomTemplate = typeof customTemplates.$inferInsert;

// ─── Deployment Log ───────────────────────────────────────────────────────────

export const deploymentLog = sqliteTable("deployment_log", {
  id: text("id").primaryKey(),
  zoneId: text("zone_id").notNull(),
  zoneName: text("zone_name").notNull(),
  ruleType: text("rule_type").notNull().default("custom"),
  ruleName: text("rule_name").notNull(),
  action: text("action").notNull(),
  details: text("details"), // JSON with extra context
  status: text("status").notNull().default("pending"), // 'success' | 'failed' | 'pending'
  errorMessage: text("error_message"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type DeploymentLog = typeof deploymentLog.$inferSelect;
export type NewDeploymentLog = typeof deploymentLog.$inferInsert;

// ─── Zone Cache ───────────────────────────────────────────────────────────────

export const zoneCache = sqliteTable("zone_cache", {
  id: text("id").primaryKey(), // zone id from Cloudflare
  name: text("name").notNull(),
  status: text("status").notNull(),
  paused: integer("paused", { mode: "boolean" }).notNull().default(false),
  planName: text("plan_name").notNull().default(""),
  planPrice: integer("plan_price").notNull().default(0),
  nameServers: text("name_servers").notNull().default("[]"), // JSON array
  accountId: text("account_id").notNull().default(""),
  rawJson: text("raw_json"), // Full CF zone JSON for future use
  syncedAt: text("synced_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type ZoneCache = typeof zoneCache.$inferSelect;
export type NewZoneCache = typeof zoneCache.$inferInsert;
