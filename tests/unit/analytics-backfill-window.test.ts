import { describe, expect, it } from "vitest";
import {
  resolveBackfillWindow,
  splitGraphQLWindows,
} from "@server/services/analytics-backfill.service";

describe("resolveBackfillWindow", () => {
  it("uses a safe 48h lookback when there is no prior success yet", () => {
    const now = new Date("2026-04-16T19:00:00.000Z");

    const window = resolveBackfillWindow(now, null);

    expect(window.until).toBe("2026-04-16T19:00:00.000Z");
    expect(window.since).toBe("2026-04-14T19:00:00.000Z");
  });

  it("clamps incremental refreshes to the safe lookback floor", () => {
    const now = new Date("2026-04-16T19:00:00.000Z");

    const window = resolveBackfillWindow(now, "2026-04-10T18:45:00.000Z");

    expect(window.until).toBe("2026-04-16T19:00:00.000Z");
    expect(window.since).toBe("2026-04-14T19:00:00.000Z");
  });

  it("uses the overlapping incremental refresh when it is already within the safe lookback", () => {
    const now = new Date("2026-04-16T19:00:00.000Z");

    const window = resolveBackfillWindow(now, "2026-04-16T18:45:00.000Z");

    expect(window.until).toBe("2026-04-16T19:00:00.000Z");
    expect(window.since).toBe("2026-04-16T16:45:00.000Z");
  });

  it("splits wide windows into GraphQL-safe 3d slices", () => {
    const windows = splitGraphQLWindows(
      "2026-03-17T19:00:00.000Z",
      "2026-04-16T19:00:00.000Z",
    );

    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0]).toEqual({
      since: "2026-03-17T19:00:00.000Z",
      until: "2026-03-20T18:59:59.999Z",
    });
    expect(windows.at(-1)).toEqual({
      since: "2026-04-16T19:00:00.000Z",
      until: "2026-04-16T19:00:00.000Z",
    });

    for (const window of windows) {
      const spanMs = new Date(window.until).getTime() - new Date(window.since).getTime();
      expect(spanMs).toBeLessThan(24 * 3 * 60 * 60 * 1000);
    }
  });
});
