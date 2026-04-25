import { describe, expect, it } from "vitest";
import {
  DIMENSION_OPTIONS,
  isDimension,
} from "../../src/client/components/analytics/DimensionTabs";

describe("DIMENSION_OPTIONS", () => {
  it("has exactly 4 entries", () => {
    expect(DIMENSION_OPTIONS).toHaveLength(4);
  });

  it("maps the 4 dim values to the documented labels", () => {
    expect(DIMENSION_OPTIONS).toEqual([
      { value: "country", label: "Geography" },
      { value: "status", label: "Status" },
      { value: "protocol", label: "Connection" },
      { value: "firewall", label: "Firewall" },
    ]);
  });
});

describe("isDimension", () => {
  it("returns true for each known dim", () => {
    expect(isDimension("country")).toBe(true);
    expect(isDimension("status")).toBe(true);
    expect(isDimension("protocol")).toBe(true);
    expect(isDimension("firewall")).toBe(true);
  });

  it("returns false for unknown values", () => {
    expect(isDimension("foo")).toBe(false);
    expect(isDimension("")).toBe(false);
    expect(isDimension("Country")).toBe(false);
    expect(isDimension("countries")).toBe(false);
  });
});
