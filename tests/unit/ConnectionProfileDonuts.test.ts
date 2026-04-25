import { describe, expect, it } from "vitest";
import { pickTopVersion } from "../../src/client/components/analytics/ConnectionProfileDonuts";

describe("pickTopVersion", () => {
  it("returns '—' for empty array", () => {
    expect(pickTopVersion([])).toBe("—");
  });

  it("returns '—' when all requests are 0", () => {
    expect(
      pickTopVersion([
        { key: "HTTP/1.1", requests: 0 },
        { key: "HTTP/2", requests: 0 },
      ])
    ).toBe("—");
  });

  it("returns the key with the highest requests", () => {
    expect(
      pickTopVersion([
        { key: "HTTP/1.0", requests: 50 },
        { key: "HTTP/1.1", requests: 500 },
        { key: "HTTP/2", requests: 1000 },
        { key: "HTTP/3", requests: 200 },
      ])
    ).toBe("HTTP/2");
  });

  it("returns the first key if there is a tie for highest requests", () => {
    expect(
      pickTopVersion([
        { key: "TLSv1.2", requests: 1000 },
        { key: "TLSv1.3", requests: 1000 },
      ])
    ).toBe("TLSv1.2");
  });
});
