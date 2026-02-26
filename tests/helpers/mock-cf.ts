/**
 * Mock CloudflareClient for unit tests.
 * Returns typed stubs for all CF API methods.
 */

import type { CloudflareClient } from "@server/services/cloudflare";
import type {
  CFZone,
  CFDNSRecord,
  CFRuleset,
  CFZoneSetting,
  CFIPAccessRule,
  CFBatchDNSResult,
} from "@server/types/cloudflare";
import { vi } from "vitest";

export function createMockCFClient(): {
  [K in keyof CloudflareClient]: ReturnType<typeof vi.fn>;
} {
  return {
    listZones: vi.fn<() => Promise<CFZone[]>>().mockResolvedValue([]),
    getZone: vi.fn<(id: string) => Promise<CFZone>>(),
    listDNSRecords: vi.fn<(zoneId: string) => Promise<CFDNSRecord[]>>().mockResolvedValue([]),
    createDNSRecord: vi.fn<() => Promise<CFDNSRecord>>(),
    updateDNSRecord: vi.fn<() => Promise<CFDNSRecord>>(),
    deleteDNSRecord: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    batchDNSRecords: vi.fn<() => Promise<CFBatchDNSResult>>(),
    getCustomWAFRules: vi.fn<() => Promise<CFRuleset>>().mockResolvedValue({
      id: "",
      name: "Custom Firewall Rules",
      description: "",
      kind: "zone",
      version: "1",
      last_updated: new Date().toISOString(),
      phase: "http_request_firewall_custom",
      rules: [],
    }),
    setCustomWAFRules: vi.fn<() => Promise<CFRuleset>>(),
    getZoneSettings: vi.fn<() => Promise<CFZoneSetting[]>>().mockResolvedValue([]),
    updateZoneSetting: vi.fn<() => Promise<CFZoneSetting>>(),
    listIPAccessRules: vi.fn<() => Promise<CFIPAccessRule[]>>().mockResolvedValue([]),
    createIPAccessRule: vi.fn<() => Promise<CFIPAccessRule>>(),
    batchZoneOperation: vi.fn().mockResolvedValue([]),
  } as unknown as { [K in keyof CloudflareClient]: ReturnType<typeof vi.fn> };
}

// Factory for a fake DNS record
export function fakeDNSRecord(overrides: Partial<CFDNSRecord> = {}): CFDNSRecord {
  return {
    id: "rec_001",
    zone_id: "zone_001",
    zone_name: "example.com",
    name: "example.com",
    type: "A",
    content: "192.0.2.1",
    proxiable: true,
    proxied: true,
    ttl: 1,
    locked: false,
    meta: { auto_added: false, source: "primary" },
    created_on: "2025-01-01T00:00:00Z",
    modified_on: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

// Factory for a fake zone
export function fakeZone(overrides: Partial<CFZone> = {}): CFZone {
  return {
    id: "zone_001",
    name: "example.com",
    status: "active",
    paused: false,
    type: "full",
    development_mode: 0,
    name_servers: ["ns1.example.com", "ns2.example.com"],
    original_name_servers: [],
    original_registrar: "",
    original_dnshost: "",
    modified_on: "2025-01-01T00:00:00Z",
    created_on: "2025-01-01T00:00:00Z",
    activated_on: "2025-01-01T00:00:00Z",
    meta: {
      step: 2,
      custom_certificate_quota: 0,
      page_rule_quota: 3,
      phishing_detected: false,
      multiple_railguns_allowed: false,
    },
    owner: { id: "owner_001", type: "user", email: "test@example.com" },
    account: { id: "acct_001", name: "Test Account" },
    permissions: ["#zone:read"],
    plan: {
      id: "free",
      name: "Free Website",
      price: 0,
      currency: "USD",
      frequency: "",
      is_subscribed: true,
      can_subscribe: false,
      legacy_id: "free",
      legacy_discount: false,
      externally_managed: false,
    },
    ...overrides,
  };
}

// Factory for a fake ruleset
export function fakeRuleset(overrides: Partial<CFRuleset> = {}): CFRuleset {
  return {
    id: "rs_001",
    name: "Custom Firewall Rules",
    description: "",
    kind: "zone",
    version: "1",
    last_updated: "2025-01-01T00:00:00Z",
    phase: "http_request_firewall_custom",
    rules: [],
    ...overrides,
  };
}
