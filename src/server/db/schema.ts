import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
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

export const groupZones = sqliteTable(
  "group_zones",
  {
    id: text("id").primaryKey(),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    zoneId: text("zone_id").notNull(),
    zoneName: text("zone_name").notNull(),
    addedAt: text("added_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    groupIdIdx: index("idx_group_zones_group_id").on(t.groupId),
    zoneIdIdx: index("idx_group_zones_zone_id").on(t.zoneId),
    uniqueGroupZoneIdx: uniqueIndex("idx_group_zones_unique").on(t.groupId, t.zoneId),
  }),
);

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

export const deploymentLog = sqliteTable(
  "deployment_log",
  {
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
  },
  (t) => ({
    zoneIdIdx: index("idx_deployment_log_zone_id").on(t.zoneId),
    createdAtIdx: index("idx_deployment_log_created_at").on(t.createdAt),
  }),
);

export type DeploymentLog = typeof deploymentLog.$inferSelect;
export type NewDeploymentLog = typeof deploymentLog.$inferInsert;

// ─── Zone Cache ───────────────────────────────────────────────────────────────

export const zoneCache = sqliteTable(
  "zone_cache",
  {
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
  },
  (t) => ({
    nameIdx: index("idx_zone_cache_name").on(t.name),
  }),
);

export type ZoneCache = typeof zoneCache.$inferSelect;
export type NewZoneCache = typeof zoneCache.$inferInsert;

// ─── Analytics (raw hourly buckets) ───────────────────────────────────────────

export const analyticsZoneHourly = sqliteTable(
  "analytics_zone_hourly",
  {
    zoneId: text("zone_id").notNull(),
    hourBucket: text("hour_bucket").notNull(), // ISO hour
    requests: integer("requests").notNull().default(0),
    bytes: integer("bytes").notNull().default(0),
    cachedBytes: integer("cached_bytes").notNull().default(0),
    threats: integer("threats").notNull().default(0),
    sampleInterval: real("sample_interval").notNull().default(1),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.zoneId, t.hourBucket] }),
  }),
);

export type AnalyticsZoneHourly = typeof analyticsZoneHourly.$inferSelect;
export type NewAnalyticsZoneHourly = typeof analyticsZoneHourly.$inferInsert;

// ─── Analytics dimensions (raw hourly buckets) ───────────────────────────────

export const analyticsZoneCountryHourly = sqliteTable(
  "analytics_zone_country_hourly",
  {
    zoneId: text("zone_id").notNull(),
    hourBucket: text("hour_bucket").notNull(),
    countryCode: text("country_code").notNull(),
    requests: integer("requests").notNull().default(0),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.zoneId, t.hourBucket, t.countryCode] }),
    zoneHourIdx: index("idx_country_zone_hour").on(t.zoneId, t.hourBucket),
  }),
);

export type AnalyticsZoneCountryHourly = typeof analyticsZoneCountryHourly.$inferSelect;
export type NewAnalyticsZoneCountryHourly = typeof analyticsZoneCountryHourly.$inferInsert;

export const analyticsZoneStatusHourly = sqliteTable(
  "analytics_zone_status_hourly",
  {
    zoneId: text("zone_id").notNull(),
    hourBucket: text("hour_bucket").notNull(),
    statusCode: integer("status_code").notNull(),
    requests: integer("requests").notNull().default(0),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.zoneId, t.hourBucket, t.statusCode] }),
    zoneHourIdx: index("idx_status_zone_hour").on(t.zoneId, t.hourBucket),
  }),
);

export type AnalyticsZoneStatusHourly = typeof analyticsZoneStatusHourly.$inferSelect;
export type NewAnalyticsZoneStatusHourly = typeof analyticsZoneStatusHourly.$inferInsert;

export const analyticsZoneHttpVersionHourly = sqliteTable(
  "analytics_zone_http_version_hourly",
  {
    zoneId: text("zone_id").notNull(),
    hourBucket: text("hour_bucket").notNull(),
    httpVersion: text("http_version").notNull(),
    requests: integer("requests").notNull().default(0),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.zoneId, t.hourBucket, t.httpVersion] }),
    zoneHourIdx: index("idx_http_version_zone_hour").on(t.zoneId, t.hourBucket),
  }),
);

export type AnalyticsZoneHttpVersionHourly = typeof analyticsZoneHttpVersionHourly.$inferSelect;
export type NewAnalyticsZoneHttpVersionHourly = typeof analyticsZoneHttpVersionHourly.$inferInsert;

export const analyticsZoneSslVersionHourly = sqliteTable(
  "analytics_zone_ssl_version_hourly",
  {
    zoneId: text("zone_id").notNull(),
    hourBucket: text("hour_bucket").notNull(),
    sslVersion: text("ssl_version").notNull(),
    requests: integer("requests").notNull().default(0),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.zoneId, t.hourBucket, t.sslVersion] }),
    zoneHourIdx: index("idx_ssl_version_zone_hour").on(t.zoneId, t.hourBucket),
  }),
);

export type AnalyticsZoneSslVersionHourly = typeof analyticsZoneSslVersionHourly.$inferSelect;
export type NewAnalyticsZoneSslVersionHourly = typeof analyticsZoneSslVersionHourly.$inferInsert;

export const analyticsZoneFirewallHourly = sqliteTable(
  "analytics_zone_firewall_hourly",
  {
    zoneId: text("zone_id").notNull(),
    hourBucket: text("hour_bucket").notNull(),
    ruleId: text("rule_id").notNull(),
    source: text("source").notNull(),
    action: text("action").notNull(),
    events: integer("events").notNull().default(0),
    fetchedAt: text("fetched_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.zoneId, t.hourBucket, t.ruleId, t.source, t.action] }),
    zoneHourIdx: index("idx_firewall_zone_hour").on(t.zoneId, t.hourBucket),
  }),
);

export type AnalyticsZoneFirewallHourly = typeof analyticsZoneFirewallHourly.$inferSelect;
export type NewAnalyticsZoneFirewallHourly = typeof analyticsZoneFirewallHourly.$inferInsert;

// ─── Analytics sync log ───────────────────────────────────────────────────────

export const analyticsSyncLog = sqliteTable("analytics_sync_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  startedAt: text("started_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  finishedAt: text("finished_at"),
  rowsUpserted: integer("rows_upserted"),
  status: text("status").notNull(), // 'success' | 'partial' | 'error'
  error: text("error"),
});

export type AnalyticsSyncLog = typeof analyticsSyncLog.$inferSelect;
export type NewAnalyticsSyncLog = typeof analyticsSyncLog.$inferInsert;

// ─── Low-frequency D1-backed leases ───────────────────────────────────────────

export const analyticsLocks = sqliteTable("analytics_locks", {
  name: text("name").primaryKey(),
  ownerId: text("owner_id").notNull(),
  expiresAt: text("expires_at").notNull(),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type AnalyticsLock = typeof analyticsLocks.$inferSelect;
export type NewAnalyticsLock = typeof analyticsLocks.$inferInsert;
