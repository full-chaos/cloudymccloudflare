-- Hourly analytics dimension aggregates for country, status, protocol, and WAF activity.
CREATE TABLE IF NOT EXISTS analytics_zone_country_hourly (
  zone_id TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  country_code TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, country_code)
);

CREATE INDEX IF NOT EXISTS idx_country_zone_hour
  ON analytics_zone_country_hourly (zone_id, hour_bucket);

CREATE TABLE IF NOT EXISTS analytics_zone_status_hourly (
  zone_id TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, status_code)
);

CREATE INDEX IF NOT EXISTS idx_status_zone_hour
  ON analytics_zone_status_hourly (zone_id, hour_bucket);

CREATE TABLE IF NOT EXISTS analytics_zone_http_version_hourly (
  zone_id TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  http_version TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, http_version)
);

CREATE INDEX IF NOT EXISTS idx_http_version_zone_hour
  ON analytics_zone_http_version_hourly (zone_id, hour_bucket);

CREATE TABLE IF NOT EXISTS analytics_zone_ssl_version_hourly (
  zone_id TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  ssl_version TEXT NOT NULL,
  requests INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, ssl_version)
);

CREATE INDEX IF NOT EXISTS idx_ssl_version_zone_hour
  ON analytics_zone_ssl_version_hourly (zone_id, hour_bucket);

CREATE TABLE IF NOT EXISTS analytics_zone_firewall_hourly (
  zone_id TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  events INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket, rule_id, source, action)
);

CREATE INDEX IF NOT EXISTS idx_firewall_zone_hour
  ON analytics_zone_firewall_hourly (zone_id, hour_bucket);
