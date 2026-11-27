import { describe, expect, it } from "vitest";
import {
  changedFields,
  recordToInput,
} from "../../src/client/components/dns/AddRecordForm";
import { filterRecords } from "../../src/client/components/dns/DNSRecordsTable";
import type { DNSRecord } from "../../src/client/types";

const record: DNSRecord = {
  id: "rec1",
  zoneId: "zone1",
  zoneName: "example.com",
  type: "A",
  name: "www.example.com",
  content: "192.0.2.1",
  proxied: true,
  proxiable: true,
  ttl: 1,
};

const mx: DNSRecord = { ...record, id: "rec2", type: "MX", name: "example.com", content: "mail.example.com", proxied: false, priority: 10 };

describe("changedFields", () => {
  it("returns an empty patch when nothing changed", () => {
    expect(changedFields(record, recordToInput(record))).toEqual({});
  });

  it("returns only the edited fields", () => {
    const input = { ...recordToInput(record), content: "192.0.2.2", proxied: false };
    expect(changedFields(record, input)).toEqual({ content: "192.0.2.2", proxied: false });
  });

  it("includes a changed MX priority", () => {
    expect(changedFields(mx, { ...recordToInput(mx), priority: 20 })).toEqual({ priority: 20 });
  });
});

describe("filterRecords", () => {
  const records = [record, mx];

  it("keeps everything for an empty query", () => {
    expect(filterRecords(records, "  ")).toBe(records);
  });

  it("matches type, name and content case-insensitively", () => {
    expect(filterRecords(records, "mx").map((r) => r.id)).toEqual(["rec2"]);
    expect(filterRecords(records, "WWW").map((r) => r.id)).toEqual(["rec1"]);
    expect(filterRecords(records, "192.0.2").map((r) => r.id)).toEqual(["rec1"]);
  });
});
