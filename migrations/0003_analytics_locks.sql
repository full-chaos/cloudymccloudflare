-- D1-backed leases for low-frequency scheduled/manual jobs.
CREATE TABLE IF NOT EXISTS analytics_locks (
  name TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
