import { describe, expect, it } from "vitest";
import { groupIntoBands } from "../../src/client/components/analytics/StatusCodeDonut";

describe("groupIntoBands", () => {
  it("returns empty for empty input", () => {
    expect(groupIntoBands([])).toEqual([]);
  });

  it("groups standard codes into 2xx/3xx/4xx/5xx", () => {
    const result = groupIntoBands([
      { key: "200", requests: 100 },
      { key: "201", requests: 5 },
      { key: "301", requests: 10 },
      { key: "404", requests: 30 },
      { key: "500", requests: 1 },
    ]);
    const map = Object.fromEntries(result.map((b) => [b.band, b.value]));
    expect(map["2xx"]).toBe(105);
    expect(map["3xx"]).toBe(10);
    expect(map["4xx"]).toBe(30);
    expect(map["5xx"]).toBe(1);
  });

  it("buckets 0/non-numeric/out-of-range into 'other'", () => {
    const result = groupIntoBands([
      { key: "0", requests: 5 },
      { key: "foo", requests: 7 },
      { key: "999", requests: 11 },
      { key: "50", requests: 2 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].band).toBe("other");
    expect(result[0].value).toBe(25);
  });

  it("filters out items with requests <= 0", () => {
    const result = groupIntoBands([
      { key: "200", requests: 0 },
      { key: "404", requests: -5 },
      { key: "500", requests: 3 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].band).toBe("5xx");
    expect(result[0].value).toBe(3);
  });

  it("returns single band when all items match", () => {
    const result = groupIntoBands([
      { key: "200", requests: 1 },
      { key: "204", requests: 2 },
      { key: "299", requests: 3 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].band).toBe("2xx");
    expect(result[0].value).toBe(6);
    expect(result[0].codes).toHaveLength(3);
  });

  it("preserves band order 2xx/3xx/4xx/5xx/other", () => {
    const result = groupIntoBands([
      { key: "500", requests: 1 },
      { key: "200", requests: 1 },
      { key: "404", requests: 1 },
      { key: "abc", requests: 1 },
      { key: "301", requests: 1 },
    ]);
    expect(result.map((r) => r.band)).toEqual(["2xx", "3xx", "4xx", "5xx", "other"]);
  });
});
