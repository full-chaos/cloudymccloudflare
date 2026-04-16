import { describe, expect, it, vi } from "vitest";
import { ensureAnalyticsSchema } from "@server/db/ensure-analytics-schema";

describe("ensureAnalyticsSchema", () => {
  it("creates analytics tables and indexes once per binding", async () => {
    const db = {
      exec: vi.fn().mockResolvedValue(undefined),
    } as unknown as D1Database;

    await ensureAnalyticsSchema(db);
    await ensureAnalyticsSchema(db);

    expect(db.exec).toHaveBeenCalledTimes(1);
    expect(db.exec).toHaveBeenCalledWith(expect.stringContaining("analytics_zone_hourly"));
    expect(db.exec).toHaveBeenCalledWith(expect.stringContaining("analytics_sync_log"));
  });

  it("runs independently for distinct bindings", async () => {
    const dbA = {
      exec: vi.fn().mockResolvedValue(undefined),
    } as unknown as D1Database;
    const dbB = {
      exec: vi.fn().mockResolvedValue(undefined),
    } as unknown as D1Database;

    await ensureAnalyticsSchema(dbA);
    await ensureAnalyticsSchema(dbB);

    expect(dbA.exec).toHaveBeenCalledTimes(1);
    expect(dbB.exec).toHaveBeenCalledTimes(1);
  });
});
