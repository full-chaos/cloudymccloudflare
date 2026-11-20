import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Database } from "@server/db";
import type { CloudflareClient } from "@server/services/cloudflare";

vi.mock("@server/services/group.service", () => ({ listGroups: vi.fn() }));
vi.mock("@server/services/dns.service", () => ({ createRecord: vi.fn(), getDNSRecords: vi.fn() }));
vi.mock("@server/services/security.service", () => ({ getDeploymentLog: vi.fn(), getWAFRules: vi.fn() }));
vi.mock("@server/services/analytics.service", () => ({
  getAccountAnalytics: vi.fn(),
  getDimensionAggregate: vi.fn(),
  getGroupAnalytics: vi.fn(),
  getZoneAnalytics: vi.fn(),
}));

import { listGroups } from "@server/services/group.service";
import { createRecord, getDNSRecords } from "@server/services/dns.service";
import { getDeploymentLog, getWAFRules } from "@server/services/security.service";
import {
  getAccountAnalytics,
  getDimensionAggregate,
  getGroupAnalytics,
  getZoneAnalytics,
} from "@server/services/analytics.service";
import { createZoneTools } from "@server/agent/tools";

const zones = [
  { id: "z1", name: "example.com" },
  { id: "z2", name: "example.org" },
];

const tools = createZoneTools({
  db: {} as Database,
  cf: {} as CloudflareClient,
  listZones: async () => zones,
});

type AnyResult = Record<string, any>;

async function run(name: keyof typeof tools, input: unknown): Promise<AnyResult> {
  const t = tools[name] as unknown as {
    execute: (i: unknown, o: unknown) => Promise<AnyResult>;
  };
  return t.execute(input, { toolCallId: "tc", messages: [] });
}

function group(over: Partial<{ id: string; name: string; zoneIds: string[]; description?: string }> = {}) {
  return {
    id: "g1",
    name: "Prod",
    color: "#fff",
    zoneIds: ["z1", "z2"],
    createdAt: "",
    updatedAt: "",
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listGroups).mockResolvedValue([]);
});

describe("list_zones", () => {
  it("returns count and zones", async () => {
    expect(await run("list_zones", {})).toEqual({ count: 2, zones });
  });
});

describe("list_groups", () => {
  it("maps zone ids to names, falling back to id", async () => {
    vi.mocked(listGroups).mockResolvedValue([group({ zoneIds: ["z1", "zX"], description: "d" })]);
    const res = await run("list_groups", {});
    expect(res.groups).toEqual([
      { id: "g1", name: "Prod", description: "d", zones: ["example.com", "zX"] },
    ]);
  });

  it("uses null for missing description", async () => {
    vi.mocked(listGroups).mockResolvedValue([group()]);
    const res = await run("list_groups", {});
    expect(res.groups[0].description).toBeNull();
  });
});

describe("get_dns_records", () => {
  it("resolves zone name case-insensitively and trims fields", async () => {
    vi.mocked(getDNSRecords).mockResolvedValue([
      { id: "r1", type: "A", name: "a.example.com", content: "1.1.1.1", proxied: true, ttl: 1, extra: "x" },
    ] as never);
    const res = await run("get_dns_records", { zone: "  EXAMPLE.com " });
    expect(getDNSRecords).toHaveBeenCalledWith(expect.anything(), "z1");
    expect(res).toEqual({
      zone: "example.com",
      count: 1,
      truncated: false,
      records: [{ type: "A", name: "a.example.com", content: "1.1.1.1", proxied: true, ttl: 1 }],
    });
  });

  it("caps at 50 records and sets truncated", async () => {
    vi.mocked(getDNSRecords).mockResolvedValue(
      Array.from({ length: 60 }, (_, i) => ({
        id: `r${i}`, type: "A", name: `n${i}`, content: "1.1.1.1", proxied: false, ttl: 1,
      })) as never,
    );
    const res = await run("get_dns_records", { zone: "z2" });
    expect(res.count).toBe(60);
    expect(res.truncated).toBe(true);
    expect(res.records).toHaveLength(50);
  });

  it("returns error mentioning list_zones for unknown zone", async () => {
    const res = await run("get_dns_records", { zone: "nope.com" });
    expect(res.error).toContain("list_zones");
    expect(getDNSRecords).not.toHaveBeenCalled();
  });
});

describe("get_waf_rules", () => {
  it("fans out over a group and isolates per-zone errors", async () => {
    vi.mocked(listGroups).mockResolvedValue([group()]);
    vi.mocked(getWAFRules).mockImplementation((async (_cf: unknown, zoneId: string) => {
      if (zoneId === "z2") throw new Error("boom");
      return { rules: [{ description: "r", action: "block", enabled: false, expression: "true" }] };
    }) as never);
    const res = await run("get_waf_rules", { target: "prod" });
    expect(res.kind).toBe("group");
    expect(res.target).toBe("Prod");
    expect(res.zoneCount).toBe(2);
    expect(res.zones).toEqual([
      { zone: "example.com", rules: [{ description: "r", action: "block", enabled: false, expression: "true" }] },
      { zone: "example.org", error: "boom" },
    ]);
    expect(res.error).toBeUndefined();
  });

  it("handles a zone name", async () => {
    vi.mocked(getWAFRules).mockResolvedValue({
      rules: [{ action: "challenge", expression: "e" }],
    } as never);
    const res = await run("get_waf_rules", { target: "example.org" });
    expect(res.kind).toBe("zone");
    expect(res.target).toBe("example.org");
    expect(getWAFRules).toHaveBeenCalledWith(expect.anything(), "z2");
    expect(res.zones[0].rules).toEqual([
      { description: "", action: "challenge", enabled: true, expression: "e" },
    ]);
  });

  it("errors on unknown target", async () => {
    const res = await run("get_waf_rules", { target: "zzz" });
    expect(res.error).toContain("get_waf_rules failed");
  });
});

describe("get_deployment_log", () => {
  it("defaults limit to 20 and maps entries", async () => {
    vi.mocked(getDeploymentLog).mockResolvedValue([
      { zoneName: "example.com", ruleName: "r", action: "block", status: "ok", errorMessage: null, createdAt: "t" },
    ] as never);
    const res = await run("get_deployment_log", {});
    expect(getDeploymentLog).toHaveBeenCalledWith(expect.anything(), 20);
    expect(res.entries).toEqual([
      { zone: "example.com", rule: "r", action: "block", status: "ok", error: null, at: "t" },
    ]);
  });

  it("passes explicit limit", async () => {
    vi.mocked(getDeploymentLog).mockResolvedValue([]);
    await run("get_deployment_log", { limit: 5 });
    expect(getDeploymentLog).toHaveBeenCalledWith(expect.anything(), 5);
  });
});

describe("get_traffic_analytics", () => {
  const perZone = [
    { zoneId: "z1", zoneName: "example.com", requests: 10, threats: 1 },
    { zoneId: "z2", requests: 30, threats: 2 },
  ];

  it("account scope", async () => {
    vi.mocked(getAccountAnalytics).mockResolvedValue({
      totals: { requests: 40 }, perZone, lastFetchedAt: "t",
    } as never);
    const res = await run("get_traffic_analytics", { scope: "account" });
    expect(getAccountAnalytics).toHaveBeenCalledWith(expect.anything(), "7d");
    expect(res.topZonesByRequests).toEqual([
      { zone: "z2", requests: 30, threats: 2 },
      { zone: "example.com", requests: 10, threats: 1 },
    ]);
    expect(res.totals).toEqual({ requests: 40 });
  });

  it("group scope", async () => {
    vi.mocked(listGroups).mockResolvedValue([group()]);
    vi.mocked(getGroupAnalytics).mockResolvedValue({
      groupName: "Prod", totals: { requests: 1 }, perZone, lastFetchedAt: "t",
    } as never);
    const res = await run("get_traffic_analytics", { scope: "group", name: "Prod", range: "24h" });
    expect(getGroupAnalytics).toHaveBeenCalledWith(expect.anything(), "g1", "24h");
    expect(res.group).toBe("Prod");
  });

  it("zone scope", async () => {
    vi.mocked(getZoneAnalytics).mockResolvedValue({ totals: { requests: 5 }, lastFetchedAt: "t" } as never);
    const res = await run("get_traffic_analytics", { scope: "zone", name: "example.com", range: "30d" });
    expect(getZoneAnalytics).toHaveBeenCalledWith(expect.anything(), "z1", "30d");
    expect(res).toMatchObject({ zone: "example.com", range: "30d", totals: { requests: 5 } });
  });

  it("errors when name is missing for group/zone", async () => {
    for (const scope of ["group", "zone"]) {
      const res = await run("get_traffic_analytics", { scope });
      expect(res.error).toContain("name is required");
    }
  });
});

describe("get_top_error_zones", () => {
  it("sums only 5xx keys, sorts desc, drops zero-error zones, computes errorRate", async () => {
    vi.mocked(getDimensionAggregate).mockImplementation((async (_db: unknown, scope: { id: string }) => {
      if (scope.id === "z1") {
        return { kind: "status", items: [
          { key: "200", requests: 900 }, { key: "500", requests: 60 }, { key: "502", requests: 40 }, { key: "404", requests: 999 },
        ] };
      }
      return { kind: "status", items: [{ key: "200", requests: 10 }, { key: "404", requests: 5 }] };
    }) as never);
    const res = await run("get_top_error_zones", { statusClass: "5xx" });
    expect(res.zonesChecked).toBe(2);
    expect(res.zones).toEqual([{ zone: "example.com", errors: 100, requests: 1999, errorRate: 0.05 }]);
  });

  it("sorts descending across zones and handles null aggregate", async () => {
    vi.mocked(getDimensionAggregate).mockImplementation((async (_db: unknown, scope: { id: string }) =>
      scope.id === "z1"
        ? { kind: "status", items: [{ key: "404", requests: 1 }, { key: "200", requests: 9 }] }
        : { kind: "status", items: [{ key: "404", requests: 5 }, { key: "200", requests: 5 }] }) as never);
    const res = await run("get_top_error_zones", { statusClass: "4xx" });
    expect(res.zones.map((z: { zone: string }) => z.zone)).toEqual(["example.org", "example.com"]);

    vi.mocked(getDimensionAggregate).mockResolvedValue(null as never);
    const empty = await run("get_top_error_zones", { statusClass: "4xx" });
    expect(empty.zones).toEqual([]);
  });
});

describe("create_dns_record", () => {
  it("requires approval", () => {
    expect((tools.create_dns_record as unknown as { needsApproval?: boolean }).needsApproval).toBe(true);
  });

  it("creates with resolved zone id", async () => {
    vi.mocked(createRecord).mockResolvedValue({ id: "r1", type: "A", name: "www.example.com", content: "1.2.3.4" } as never);
    const res = await run("create_dns_record", { zone: "Example.COM", type: "A", name: "www", content: "1.2.3.4" });
    expect(createRecord).toHaveBeenCalledWith(
      expect.anything(), "z1", expect.objectContaining({ type: "A", name: "www", content: "1.2.3.4" }),
    );
    expect(res).toEqual({
      zone: "example.com",
      created: { id: "r1", type: "A", name: "www.example.com", content: "1.2.3.4" },
    });
  });

  it("returns error without calling createRecord on invalid input", async () => {
    const res = await run("create_dns_record", { zone: "example.com", type: "A", name: "www", content: "" });
    expect(res.error).toContain("create_dns_record failed");
    expect(res.error).toContain("Content is required");
    expect(createRecord).not.toHaveBeenCalled();
  });

  it("returns error for unknown zone without calling createRecord", async () => {
    const res = await run("create_dns_record", { zone: "nope.com", type: "A", name: "www", content: "1.2.3.4" });
    expect(res.error).toContain("list_zones");
    expect(createRecord).not.toHaveBeenCalled();
  });
});

describe("error wrapping", () => {
  it("turns a service throw into { error }", async () => {
    vi.mocked(getDNSRecords).mockRejectedValue(new Error("cf down"));
    expect(await run("get_dns_records", { zone: "example.com" })).toEqual({
      error: "get_dns_records failed: cf down",
    });
  });

  it("stringifies non-Error throws", async () => {
    vi.mocked(getDeploymentLog).mockRejectedValue("bad");
    expect(await run("get_deployment_log", {})).toEqual({ error: "get_deployment_log failed: bad" });
  });
});
