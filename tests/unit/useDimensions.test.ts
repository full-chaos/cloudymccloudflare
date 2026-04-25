import { describe, expect, it } from "vitest";
import { dimensionsCacheKey } from "../../src/client/hooks/useDimensions";
import { dimensionPathForScope } from "../../src/client/lib/api";

describe("dimensionsCacheKey", () => {
  it("uses sentinel for account scope (no id)", () => {
    expect(dimensionsCacheKey({ kind: "account" }, "country", "24h")).toBe(
      "account|_|country|24h",
    );
  });

  it("includes id for scoped variants", () => {
    expect(dimensionsCacheKey({ kind: "group", id: "g1" }, "status", "7d")).toBe(
      "group|g1|status|7d",
    );
    expect(dimensionsCacheKey({ kind: "cluster", id: "chrisgeorge" }, "protocol", "30d")).toBe(
      "cluster|chrisgeorge|protocol|30d",
    );
    expect(dimensionsCacheKey({ kind: "zone", id: "z1" }, "firewall", "24h")).toBe(
      "zone|z1|firewall|24h",
    );
  });

  it("differentiates dim and range", () => {
    const a = dimensionsCacheKey({ kind: "account" }, "country", "24h");
    const b = dimensionsCacheKey({ kind: "account" }, "country", "7d");
    const c = dimensionsCacheKey({ kind: "account" }, "status", "24h");
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(b).not.toBe(c);
  });
});

describe("dimensionPathForScope", () => {
  it("returns the documented endpoint paths", () => {
    expect(dimensionPathForScope({ kind: "account" })).toBe("/analytics/account/dimensions");
    expect(dimensionPathForScope({ kind: "group", id: "abc123" })).toBe(
      "/analytics/group/abc123/dimensions",
    );
    expect(dimensionPathForScope({ kind: "cluster", id: "chrisgeorge" })).toBe(
      "/analytics/cluster/chrisgeorge/dimensions",
    );
    expect(dimensionPathForScope({ kind: "zone", id: "z1" })).toBe(
      "/analytics/zone/z1/dimensions",
    );
  });

  it("URI-encodes ids with special chars", () => {
    expect(dimensionPathForScope({ kind: "cluster", id: "chris george" })).toBe(
      "/analytics/cluster/chris%20george/dimensions",
    );
  });
});
