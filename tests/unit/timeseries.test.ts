import { describe, expect, it } from "vitest";
import type { ZoneTimeSeriesPoint } from "@shared/types";
import { binByDay, binSeriesIfNeeded } from "@client/lib/timeseries";

function hourSeries(
  startIso: string,
  hours: number,
  makePoint: (hourIndex: number, timestamp: string) => ZoneTimeSeriesPoint,
): ZoneTimeSeriesPoint[] {
  const start = new Date(startIso).getTime();
  return Array.from({ length: hours }, (_, hourIndex) =>
    makePoint(hourIndex, new Date(start + hourIndex * 3_600_000).toISOString()),
  );
}

describe("timeseries binning", () => {
  it("bins 24 hourly points into 1 UTC day", () => {
    const series = hourSeries("2026-04-25T00:00:00.000Z", 24, (hourIndex, timestamp) => ({
      timestamp,
      requests: hourIndex + 1,
      bytes: hourIndex + 1,
      cachedBytes: hourIndex + 1,
      threats: hourIndex + 1,
    }));

    const binned = binByDay(series);

    expect(binned).toHaveLength(1);
    expect(binned[0]).toEqual({
      timestamp: "2026-04-25T00:00:00.000Z",
      requests: 300,
      bytes: 300,
      cachedBytes: 300,
      threats: 300,
    });
  });

  it("bins 48 hourly points across 2 UTC days", () => {
    const series = hourSeries("2026-04-25T00:00:00.000Z", 48, () => ({
      timestamp: "",
      requests: 1,
      bytes: 2,
      cachedBytes: 3,
      threats: 4,
    })).map((point, index) => ({
      ...point,
      timestamp: new Date(Date.parse("2026-04-25T00:00:00.000Z") + index * 3_600_000).toISOString(),
    }));

    const binned = binByDay(series);

    expect(binned).toEqual([
      {
        timestamp: "2026-04-25T00:00:00.000Z",
        requests: 24,
        bytes: 48,
        cachedBytes: 72,
        threats: 96,
      },
      {
        timestamp: "2026-04-26T00:00:00.000Z",
        requests: 24,
        bytes: 48,
        cachedBytes: 72,
        threats: 96,
      },
    ]);
  });

  it("keeps all-null days null per metric", () => {
    const series = hourSeries("2026-04-25T00:00:00.000Z", 24, (_, timestamp) => ({
      timestamp,
      requests: null,
      bytes: null,
      cachedBytes: null,
      threats: null,
    }));

    expect(binByDay(series)).toEqual([
      {
        timestamp: "2026-04-25T00:00:00.000Z",
        requests: null,
        bytes: null,
        cachedBytes: null,
        threats: null,
      },
    ]);
  });

  it("sums mixed null and value hours", () => {
    const series: ZoneTimeSeriesPoint[] = [
      {
        timestamp: "2026-04-25T00:00:00.000Z",
        requests: null,
        bytes: 2,
        cachedBytes: null,
        threats: 10,
      },
      {
        timestamp: "2026-04-25T01:00:00.000Z",
        requests: 5,
        bytes: null,
        cachedBytes: 7,
        threats: null,
      },
    ];

    expect(binByDay(series)).toEqual([
      {
        timestamp: "2026-04-25T00:00:00.000Z",
        requests: 5,
        bytes: 2,
        cachedBytes: 7,
        threats: 10,
      },
    ]);
  });

  it("returns the original array for non-30d ranges", () => {
    const series: ZoneTimeSeriesPoint[] = [
      {
        timestamp: "2026-04-25T00:00:00.000Z",
        requests: 1,
        bytes: 1,
        cachedBytes: 1,
        threats: 1,
      },
    ];

    expect(binSeriesIfNeeded(series, "24h")).toBe(series);
    expect(binSeriesIfNeeded(series, "7d")).toBe(series);
  });

  it("bins when the range is 30d", () => {
    const series = hourSeries("2026-04-25T00:00:00.000Z", 24, (_, timestamp) => ({
      timestamp,
      requests: 1,
      bytes: 1,
      cachedBytes: 1,
      threats: 1,
    }));

    const binned = binSeriesIfNeeded(series, "30d");

    expect(binned).not.toBe(series);
    expect(binned).toHaveLength(1);
  });
});
