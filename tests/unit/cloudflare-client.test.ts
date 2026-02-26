import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CloudflareClient, CloudflareApiError } from "@server/services/cloudflare";

const originalFetch = globalThis.fetch;

function mockFetch(response: unknown, options: { status?: number; headers?: Record<string, string> } = {}) {
  const { status = 200, headers = {} } = options;
  globalThis.fetch = vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
    json: () => Promise.resolve(response),
  });
}

describe("CloudflareClient", () => {
  let client: CloudflareClient;

  beforeEach(() => {
    client = new CloudflareClient("test-token", "acct-123");
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("listZones", () => {
    it("returns zones from a single page", async () => {
      mockFetch({
        success: true,
        result: [{ id: "z1", name: "example.com" }],
        errors: [],
        messages: [],
        result_info: { page: 1, per_page: 50, count: 1, total_count: 1, total_pages: 1 },
      });

      const zones = await client.listZones();
      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe("example.com");

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[0]).toContain("/zones?");
      expect(call[0]).toContain("account.id=acct-123");
      expect(call[1].headers.Authorization).toBe("Bearer test-token");
    });

    it("paginates across multiple pages", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({
            success: true,
            result: [{ id: "z1" }],
            errors: [],
            messages: [],
            result_info: { page: 1, per_page: 50, count: 1, total_count: 2, total_pages: 2 },
          }),
        })
        .mockResolvedValueOnce({
          status: 200,
          json: () => Promise.resolve({
            success: true,
            result: [{ id: "z2" }],
            errors: [],
            messages: [],
            result_info: { page: 2, per_page: 50, count: 1, total_count: 2, total_pages: 2 },
          }),
        });

      globalThis.fetch = fetchMock;

      const zones = await client.listZones();
      expect(zones).toHaveLength(2);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("throws CloudflareApiError on API failure", async () => {
      mockFetch({
        success: false,
        result: null,
        errors: [{ code: 6003, message: "Invalid request headers" }],
        messages: [],
      });

      await expect(client.listZones()).rejects.toThrow(CloudflareApiError);
    });
  });

  describe("getZone", () => {
    it("returns zone data", async () => {
      mockFetch({
        success: true,
        result: { id: "z1", name: "example.com", status: "active" },
        errors: [],
        messages: [],
      });

      const zone = await client.getZone("z1");
      expect(zone.name).toBe("example.com");
    });
  });

  describe("createDNSRecord", () => {
    it("sends POST with record data", async () => {
      const record = { id: "rec1", type: "A", name: "test.example.com", content: "1.2.3.4" };
      mockFetch({
        success: true,
        result: record,
        errors: [],
        messages: [],
      });

      const result = await client.createDNSRecord("z1", {
        type: "A",
        name: "test.example.com",
        content: "1.2.3.4",
      });

      expect(result.id).toBe("rec1");
      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].method).toBe("POST");
      expect(JSON.parse(call[1].body)).toEqual({
        type: "A",
        name: "test.example.com",
        content: "1.2.3.4",
      });
    });
  });

  describe("deleteDNSRecord", () => {
    it("sends DELETE request", async () => {
      mockFetch(undefined, { status: 200 });

      await client.deleteDNSRecord("z1", "rec1");

      const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(call[1].method).toBe("DELETE");
      expect(call[0]).toContain("/zones/z1/dns_records/rec1");
    });
  });

  describe("getCustomWAFRules", () => {
    it("returns empty ruleset when no custom phase exists", async () => {
      mockFetch({
        success: true,
        result: [
          { id: "rs1", phase: "http_ratelimit", kind: "zone" },
        ],
        errors: [],
        messages: [],
      });

      const ruleset = await client.getCustomWAFRules("z1");
      expect(ruleset.rules).toEqual([]);
      expect(ruleset.phase).toBe("http_request_firewall_custom");
    });
  });

  describe("batchZoneOperation", () => {
    it("runs operations across zones with results", async () => {
      const results = await client.batchZoneOperation(
        ["z1", "z2"],
        async (zoneId) => `done-${zoneId}`
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ zoneId: "z1", result: "done-z1" });
      expect(results[1]).toEqual({ zoneId: "z2", result: "done-z2" });
    });

    it("captures errors per zone without failing", async () => {
      const results = await client.batchZoneOperation(
        ["z1", "z2"],
        async (zoneId) => {
          if (zoneId === "z1") throw new Error("Zone z1 failed");
          return "ok";
        }
      );

      expect(results[0]).toEqual({ zoneId: "z1", error: "Zone z1 failed" });
      expect(results[1]).toEqual({ zoneId: "z2", result: "ok" });
    });
  });
});
