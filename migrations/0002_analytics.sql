-- CloudlyMcCloudFlare analytics schema
-- Raw hourly buckets per zone, fetched by the scheduled Worker.
-- Source of truth for all analytics reads — aggregations compute via SUM+GROUP BY.
CREATE TABLE IF NOT EXISTS analytics_zone_hourly (
  zone_id         TEXT NOT NULL,
  hour_bucket     TEXT NOT NULL,             -- ISO: '2026-04-16T14:00:00Z'
  requests        INTEGER NOT NULL DEFAULT 0,
  bytes           INTEGER NOT NULL DEFAULT 0,
  cached_bytes    INTEGER NOT NULL DEFAULT 0,
  threats         INTEGER NOT NULL DEFAULT 0,
  sample_interval REAL NOT NULL DEFAULT 1,   -- >1 means CF adaptive-sampled the bucket
  fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (zone_id, hour_bucket)
);

CREATE INDEX IF NOT EXISTS idx_azh_hour ON analytics_zone_hourly(hour_bucket);
CREATE INDEX IF NOT EXISTS idx_azh_zone_hour ON analytics_zone_hourly(zone_id, hour_bucket DESC);

-- Backfill run log. Powers the "last updated X min ago" indicator and surfaces errors.
CREATE TABLE IF NOT EXISTS analytics_sync_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  finished_at   TEXT,
  rows_upserted INTEGER,
  status        TEXT NOT NULL,               -- 'success' | 'partial' | 'error'
  error         TEXT
);

CREATE INDEX IF NOT EXISTS idx_asl_finished_at ON analytics_sync_log(finished_at DESC);
