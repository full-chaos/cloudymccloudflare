import { describe, it, expect, beforeEach } from "vitest";
import { getDNSRecords, createRecord, updateRecord, deleteRecord } from "@server/services/dns.service";
import { createMockCFClient, fakeDNSRecord } from "../helpers/mock-cf";
import type { CloudflareClient } from "@server/services/cloudflare";

describe("dns.service", () => {
  let mockCf: ReturnType<typeof createMockCFClient>;

  beforeEach(() => {
    mockCf = createMockCFClient();
  });

  describe("getDNSRecords", () => {
    it("delegates to CloudflareClient.listDNSRecords", async () => {
      const records = [fakeDNSRecord(), fakeDNSRecord({ id: "rec_002" })];
      mockCf.listDNSRecords.mockResolvedValue(records);

      const result = await getDNSRecords(mockCf as unknown as CloudflareClient, "zone_001");

      expect(mockCf.listDNSRecords).toHaveBeenCalledWith("zone_001");
      expect(result).toEqual(records);
    });
  });

  describe("createRecord", () => {
    it("passes correct fields to CloudflareClient", async () => {
      const created = fakeDNSRecord({ id: "rec_new" });
      mockCf.createDNSRecord.mockResolvedValue(created);

      const input = {
        type: "A" as const,
        name: "test.example.com",
        content: "192.0.2.1",
        ttl: 300,
        proxied: true,
      };

      const result = await createRecord(mockCf as unknown as CloudflareClient, "zone_001", input);

      expect(mockCf.createDNSRecord).toHaveBeenCalledWith("zone_001", {
        type: "A",
        name: "test.example.com",
        content: "192.0.2.1",
        ttl: 300,
        proxied: true,
        priority: undefined,
      });
      expect(result).toEqual(created);
    });
  });

  describe("updateRecord", () => {
    it("passes partial update to CloudflareClient", async () => {
      const updated = fakeDNSRecord({ content: "192.0.2.2" });
      mockCf.updateDNSRecord.mockResolvedValue(updated);

      const input = { content: "192.0.2.2" };

      const result = await updateRecord(
        mockCf as unknown as CloudflareClient,
        "zone_001",
        "rec_001",
        input
      );

      expect(mockCf.updateDNSRecord).toHaveBeenCalledWith("zone_001", "rec_001", expect.objectContaining({
        content: "192.0.2.2",
      }));
      expect(result).toEqual(updated);
    });
  });

  describe("deleteRecord", () => {
    it("delegates to CloudflareClient.deleteDNSRecord", async () => {
      mockCf.deleteDNSRecord.mockResolvedValue(undefined);

      await deleteRecord(mockCf as unknown as CloudflareClient, "zone_001", "rec_001");

      expect(mockCf.deleteDNSRecord).toHaveBeenCalledWith("zone_001", "rec_001");
    });
  });
});
