import type { CloudflareClient } from "./cloudflare";
import type { CFDNSRecord, CFBatchDNSRequest, CFBatchDNSResult } from "../types/cloudflare";
import type { CreateDNSRecordInput, UpdateDNSRecordInput } from "@shared/validators";

// ─── DNS Service ──────────────────────────────────────────────────────────────

export async function getDNSRecords(
  cf: CloudflareClient,
  zoneId: string
): Promise<CFDNSRecord[]> {
  return cf.listDNSRecords(zoneId);
}

export async function createRecord(
  cf: CloudflareClient,
  zoneId: string,
  data: CreateDNSRecordInput
): Promise<CFDNSRecord> {
  return cf.createDNSRecord(zoneId, {
    type: data.type,
    name: data.name,
    content: data.content,
    ttl: data.ttl,
    proxied: data.proxied,
    priority: data.priority,
  });
}

export async function updateRecord(
  cf: CloudflareClient,
  zoneId: string,
  recordId: string,
  data: UpdateDNSRecordInput
): Promise<CFDNSRecord> {
  return cf.updateDNSRecord(zoneId, recordId, {
    type: data.type,
    name: data.name,
    content: data.content,
    ttl: data.ttl,
    proxied: data.proxied,
    priority: data.priority,
  });
}

export async function deleteRecord(
  cf: CloudflareClient,
  zoneId: string,
  recordId: string
): Promise<void> {
  return cf.deleteDNSRecord(zoneId, recordId);
}

// ─── Batch Apply to Multiple Zones ───────────────────────────────────────────

export interface ZoneBatchResult {
  zoneId: string;
  result?: CFBatchDNSResult;
  error?: string;
}

export async function batchApplyRecords(
  cf: CloudflareClient,
  zoneIds: string[],
  records: CFBatchDNSRequest
): Promise<ZoneBatchResult[]> {
  return cf.batchZoneOperation(zoneIds, (zoneId) =>
    cf.batchDNSRecords(zoneId, records)
  );
}
