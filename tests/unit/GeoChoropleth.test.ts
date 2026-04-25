import { describe, expect, it, vi } from "vitest";
import { renderToString } from "react-dom/server";
import React from "react";
import { GeoChoropleth, filterCountryItems } from "../../src/client/components/analytics/GeoChoropleth";

vi.mock("react-svg-worldmap", () => ({
  default: vi.fn(() => null),
  WorldMap: vi.fn(() => null),
}));

describe("GeoChoropleth", () => {
  it("returns empty-state component when items array is empty", () => {
    const element = React.createElement(GeoChoropleth, { items: [] });
    const html = renderToString(element);
    expect(html).toContain("No country data in this window.");
  });

  // We test the pure helper function directly since the vitest environment is "node"
  // and mounting real DOM components is complex without jsdom.
  it("filters out 'XX' country codes from the data", () => {
    const items = [
      { key: "US", requests: 100 },
      { key: "XX", requests: 50 },
      { key: "", requests: 10 },
    ];
    const { validItems, unknownRequests } = filterCountryItems(items);
    
    expect(validItems).toEqual([{ country: "us", value: 100 }]);
    expect(unknownRequests).toBe(60);
  });

  it("filters out items with requests <= 0", () => {
    const items = [
      { key: "US", requests: 100 },
      { key: "CA", requests: 0 },
      { key: "GB", requests: -5 },
    ];
    const { validItems, unknownRequests } = filterCountryItems(items);
    
    expect(validItems).toEqual([{ country: "us", value: 100 }]);
    expect(unknownRequests).toBe(0);
  });
});
