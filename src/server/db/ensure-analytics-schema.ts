const ANALYTICS_SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS analytics_zone_hourly (
    zone_id         TEXT NOT NULL,
    hour_bucket     TEXT NOT NULL,
    requests        INTEGER NOT NULL DEFAULT 0,
    bytes           INTEGER NOT NULL DEFAULT 0,
    cached_bytes    INTEGER NOT NULL DEFAULT 0,
    threats         INTEGER NOT NULL DEFAULT 0,
    sample_interval REAL NOT NULL DEFAULT 1,
    fetched_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (zone_id, hour_bucket)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_azh_hour ON analytics_zone_hourly(hour_bucket)",
  "CREATE INDEX IF NOT EXISTS idx_azh_zone_hour ON analytics_zone_hourly(zone_id, hour_bucket DESC)",
  `CREATE TABLE IF NOT EXISTS analytics_sync_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at    TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at   TEXT,
    rows_upserted INTEGER,
    status        TEXT NOT NULL,
    error         TEXT
  )`,
  "CREATE INDEX IF NOT EXISTS idx_asl_finished_at ON analytics_sync_log(finished_at DESC)",
] as const;

const ensuredBindings = new WeakSet<D1Database>();

export async function ensureAnalyticsSchema(db: D1Database): Promise<void> {
  if (ensuredBindings.has(db)) {
    return;
  }

  for (const statement of ANALYTICS_SCHEMA_STATEMENTS) {
    await db.exec(statement);
  }
  ensuredBindings.add(db);
}
