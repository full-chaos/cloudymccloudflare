import { describe, expect, it, vi } from "vitest";
import { ensureAnalyticsSchema } from "@server/db/ensure-analytics-schema";

describe("ensureAnalyticsSchema", () => {
  it("creates analytics tables and indexes once per binding", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const db = {
      prepare: vi.fn(() => ({ run })),
    } as unknown as D1Database;

    await ensureAnalyticsSchema(db);
    await ensureAnalyticsSchema(db);

    expect(db.prepare).toHaveBeenCalledTimes(5);
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS analytics_zone_hourly"));
    expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("CREATE TABLE IF NOT EXISTS analytics_sync_log"));
    expect(run).toHaveBeenCalledTimes(5);
  });

  it("runs independently for distinct bindings", async () => {
    const runA = vi.fn().mockResolvedValue(undefined);
    const runB = vi.fn().mockResolvedValue(undefined);
    const dbA = {
      prepare: vi.fn(() => ({ run: runA })),
    } as unknown as D1Database;
    const dbB = {
      prepare: vi.fn(() => ({ run: runB })),
    } as unknown as D1Database;

    await ensureAnalyticsSchema(dbA);
    await ensureAnalyticsSchema(dbB);

    expect(dbA.prepare).toHaveBeenCalledTimes(5);
    expect(dbB.prepare).toHaveBeenCalledTimes(5);
    expect(runA).toHaveBeenCalledTimes(5);
    expect(runB).toHaveBeenCalledTimes(5);
  });
});
