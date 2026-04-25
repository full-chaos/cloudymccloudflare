import { describe, expect, it } from "vitest";
import { splitFirewallWindows } from "../../src/server/services/analytics-backfill.service";

describe("splitFirewallWindows", () => {
  it("caps each window at 1 day", () => {
    const windows = splitFirewallWindows(
      "2026-04-20T00:00:00.000Z",
      "2026-04-23T00:00:00.000Z",
    );

    for (const window of windows) {
      const spanMs = Date.parse(window.until) - Date.parse(window.since) + 1;
      expect(spanMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    }
  });

  it("splits multi-day input into contiguous windows", () => {
    const windows = splitFirewallWindows(
      "2026-04-20T12:00:00.000Z",
      "2026-04-22T13:30:00.000Z",
    );

    expect(windows).toEqual([
      {
        since: "2026-04-20T12:00:00.000Z",
        until: "2026-04-21T11:59:59.999Z",
      },
      {
        since: "2026-04-21T12:00:00.000Z",
        until: "2026-04-22T11:59:59.999Z",
      },
      {
        since: "2026-04-22T12:00:00.000Z",
        until: "2026-04-22T13:30:00.000Z",
      },
    ]);
  });

  it("preserves caller-provided overlap without adding internal gaps", () => {
    const first = splitFirewallWindows(
      "2026-04-20T00:00:00.000Z",
      "2026-04-21T02:00:00.000Z",
    );
    const overlapped = splitFirewallWindows(
      "2026-04-21T00:00:00.000Z",
      "2026-04-21T04:00:00.000Z",
    );

    const firstLastWindow = first[first.length - 1];

    expect(firstLastWindow?.until).toBe("2026-04-21T02:00:00.000Z");
    expect(overlapped[0].since).toBe("2026-04-21T00:00:00.000Z");
    expect(Date.parse(overlapped[0].since)).toBeLessThan(Date.parse(firstLastWindow?.until ?? ""));
  });
});
