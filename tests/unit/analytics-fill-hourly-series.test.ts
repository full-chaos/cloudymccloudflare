import { describe, expect, it } from "vitest";
import { fillHourlySeries } from "@server/services/analytics.service";

const since = "2026-04-11T17:00:00.000Z"; // 7d window start
const until = "2026-04-18T17:00:00.000Z"; // now, snapped to hour

describe("fillHourlySeries", () => {
  it("emits 168 points for a 7d window, all null when no buckets exist yet", () => {
    const series = fillHourlySeries([], since, until, "2026-04-18T17:02:30.000Z");

    expect(series).toHaveLength(168);
    expect(series[0].timestamp).toBe(since);
    expect(series[series.length - 1].timestamp).toBe("2026-04-18T16:00:00.000Z");
    expect(series.every((p) => p.requests === null)).toBe(true);
  });

  it("snaps lastFetchedAt down to the hour so a mid-hour run doesn't claim a partial bucket", () => {
    const buckets = [
      { hourBucket: "2026-04-18T13:00:00Z", requests: 10, bytes: 100, cachedBytes: 0, threats: 0 },
    ];
    const series = fillHourlySeries(buckets, since, until, "2026-04-18T16:43:00.000Z");

    // 16:00 was still partial at 16:43 when the run finished, so the fetched
    // range ends at 16:00 exclusive — 15:00 is the last numeric point.
    const p15 = series.find((p) => p.timestamp === "2026-04-18T15:00:00.000Z");
    const p16 = series.find((p) => p.timestamp === "2026-04-18T16:00:00.000Z");
    expect(p15?.requests).toBe(0); // zero-filled inside fetched range
    expect(p16?.requests).toBeNull(); // outside — hour wasn't finished when run ended
  });

  it("emits real values inside the fetched range and null outside", () => {
    const buckets = [
      // Ordered ASC like the DB query returns it.
      { hourBucket: "2026-04-16T00:00:00Z", requests: 5, bytes: 3663, cachedBytes: 0, threats: 0 },
      { hourBucket: "2026-04-18T04:00:00Z", requests: 3188, bytes: 10_000_000, cachedBytes: 2_000_000, threats: 0 },
    ];
    const series = fillHourlySeries(buckets, since, until, until);

    const peak = series.find((p) => p.timestamp === "2026-04-18T04:00:00.000Z");
    const earliestHit = series.find((p) => p.timestamp === "2026-04-16T00:00:00.000Z");
    const beforeFetched = series.find((p) => p.timestamp === "2026-04-12T00:00:00.000Z");
    const insideGap = series.find((p) => p.timestamp === "2026-04-17T00:00:00.000Z");

    expect(peak?.requests).toBe(3188);
    expect(earliestHit?.requests).toBe(5);
    expect(beforeFetched?.requests).toBeNull(); // earlier than first bucket
    expect(insideGap?.requests).toBe(0); // inside fetched range, zero traffic
  });

  it("reproduces the reported bug's shape: 72 contiguous buckets at the end of a 7d window", () => {
    // Fake prod shape: 72 consecutive hourly buckets ending at `until`.
    const firstBucketMs = Date.parse(until) - 72 * HOUR_MS;
    const buckets = Array.from({ length: 72 }, (_, i) => ({
      hourBucket: new Date(firstBucketMs + i * HOUR_MS)
        .toISOString()
        .replace(".000Z", "Z"),
      requests: 10,
      bytes: 1000,
      cachedBytes: 0,
      threats: 0,
    }));
    const series = fillHourlySeries(buckets, since, until, until);

    expect(series).toHaveLength(168);

    // Left 96 hours: null (before first bucket)
    expect(series.slice(0, 96).every((p) => p.requests === null)).toBe(true);
    // Right 72 hours: numeric (all 10)
    expect(series.slice(96).every((p) => p.requests === 10)).toBe(true);
  });

  it("treats null lastFetchedAt as 'nothing fetched yet' — all points are null", () => {
    const buckets = [
      { hourBucket: "2026-04-17T12:00:00Z", requests: 100, bytes: 1000, cachedBytes: 0, threats: 0 },
    ];
    const series = fillHourlySeries(buckets, since, until, null);
    expect(series.every((p) => p.requests === null)).toBe(true);
  });
});

const HOUR_MS = 60 * 60 * 1000;
