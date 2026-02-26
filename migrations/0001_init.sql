-- CloudlyMcCloudFlare initial schema
-- Groups for organizing zones
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Zone memberships in groups
CREATE TABLE IF NOT EXISTS group_zones (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  zone_id TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_group_zones_group_id ON group_zones(group_id);
CREATE INDEX IF NOT EXISTS idx_group_zones_zone_id ON group_zones(zone_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_group_zones_unique ON group_zones(group_id, zone_id);

-- Custom rule templates
CREATE TABLE IF NOT EXISTS custom_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  expression TEXT NOT NULL,
  action TEXT NOT NULL,
  category TEXT,
  rules_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Deployment audit log
CREATE TABLE IF NOT EXISTS deployment_log (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  rule_type TEXT NOT NULL DEFAULT 'custom',
  rule_name TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deployment_log_zone_id ON deployment_log(zone_id);
CREATE INDEX IF NOT EXISTS idx_deployment_log_created_at ON deployment_log(created_at);

-- Zone cache from Cloudflare API
CREATE TABLE IF NOT EXISTS zone_cache (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  paused INTEGER NOT NULL DEFAULT 0,
  plan_name TEXT NOT NULL DEFAULT '',
  plan_price INTEGER NOT NULL DEFAULT 0,
  name_servers TEXT NOT NULL DEFAULT '[]',
  account_id TEXT NOT NULL DEFAULT '',
  raw_json TEXT,
  synced_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_zone_cache_name ON zone_cache(name);
