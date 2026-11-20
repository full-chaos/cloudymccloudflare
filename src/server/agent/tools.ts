import { tool, type UIMessage } from "ai";
import { z } from "zod";
import type { Database } from "../db";
import { createDb, zoneCache } from "../db";
import { CloudflareClient } from "../services/cloudflare";
import { listGroups } from "../services/group.service";
import { createRecord, getDNSRecords } from "../services/dns.service";
import { getDeploymentLog, getWAFRules } from "../services/security.service";
import {
  getAccountAnalytics,
  getDimensionAggregate,
  getGroupAnalytics,
  getZoneAnalytics,
} from "../services/analytics.service";
import { DNS_RECORD_TYPES } from "@shared/constants";
import { createDNSRecordSchema } from "@shared/validators";
import type { AccountTotals, AnalyticsRange, Group } from "@shared/types";
import type { Bindings } from "../types/env";

// Llama 3.3 has a 24k-token context window, so every tool trims its output.
const MAX_ZONES = 100;
const MAX_DNS_RECORDS = 50;
const MAX_WAF_ZONES = 10;
const TOP_N = 10;

export type ZoneRef = { id: string; name: string };

export interface ToolDeps {
  db: Database;
  cf: CloudflareClient;
  listZones: () => Promise<ZoneRef[]>;
}

export function createToolDeps(env: Bindings): ToolDeps {
  const db = createDb(env.DB);
  const cf = new CloudflareClient(env.CF_API_TOKEN, env.CF_ACCOUNT_ID);
  return {
    db,
    cf,
    listZones: async () => {
      const cached = await db
        .select({ id: zoneCache.id, name: zoneCache.name })
        .from(zoneCache)
        .orderBy(zoneCache.name);
      if (cached.length > 0) return cached;
      const live = await cf.listZones();
      return live.map((z) => ({ id: z.id, name: z.name }));
    },
  };
}

export type ToolError = { error: string };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Tool failures go back to the model as data so it can explain them instead of the turn crashing.
async function safely<T>(label: string, fn: () => Promise<T>): Promise<T | ToolError> {
  try {
    return await fn();
  } catch (err) {
    return { error: `${label} failed: ${errorMessage(err)}` };
  }
}

function matches(candidate: { id: string; name: string }, query: string): boolean {
  const q = query.trim().toLowerCase();
  return candidate.id.toLowerCase() === q || candidate.name.toLowerCase() === q;
}

async function resolveZone(deps: ToolDeps, query: string): Promise<ZoneRef> {
  const zones = await deps.listZones();
  const zone = zones.find((z) => matches(z, query));
  if (!zone) throw new Error(`No zone named "${query}". Call list_zones to see valid names.`);
  return zone;
}

async function findGroup(deps: ToolDeps, query: string): Promise<Group | undefined> {
  const groups = await listGroups(deps.db);
  return groups.find((g) => matches(g, query));
}

async function resolveGroup(deps: ToolDeps, query: string): Promise<Group> {
  const group = await findGroup(deps, query);
  if (!group) throw new Error(`No group named "${query}". Call list_groups to see valid names.`);
  return group;
}

// Llama 3.3 often sends booleans and numbers as strings ("false", "3600"); accept both forms.
const looseBoolean = z
  .union([z.boolean(), z.enum(["true", "false"])])
  .transform((v) => v === true || v === "true");

const looseInt = z
  .union([z.number().int(), z.string().regex(/^\d+$/)])
  .transform((v) => Number(v));

const rangeSchema = z
  .enum(["24h", "7d", "30d"])
  .optional()
  .describe('Time window. "this week" means "7d". Default "7d".');

function rangeOrDefault(range: AnalyticsRange | undefined): AnalyticsRange {
  return range ?? "7d";
}

type DnsRecordRef = { zone: string; type: string; name: string; content: string };

export function dnsRecordKey(r: DnsRecordRef): string {
  return [r.zone, r.type, r.name, r.content].map((v) => v.trim().toLowerCase()).join("|");
}

// Llama 3.3 sometimes repeats a successful create_dns_record in a later step. Records already
// created since the user's last message are skipped without a second approval or API call.
export function createdRecordKeysSinceLastUserMessage(messages: UIMessage[]): Set<string> {
  const keys = new Set<string>();
  const lastUser = messages.map((m) => m.role).lastIndexOf("user");
  for (const message of messages.slice(lastUser + 1)) {
    for (const part of message.parts) {
      if (part.type !== "tool-create_dns_record" || part.state !== "output-available") continue;
      const output = part.output as { created?: unknown } | null;
      if (output && typeof output === "object" && output.created) {
        keys.add(dnsRecordKey(part.input as DnsRecordRef));
      }
    }
  }
  return keys;
}

function roundTotals(totals: AccountTotals): AccountTotals {
  return { ...totals, cacheHitRatio: Number(totals.cacheHitRatio.toFixed(3)) };
}

export function createZoneTools(deps: ToolDeps, createdRecordKeys: Set<string> = new Set()) {
  return {
    list_zones: tool({
      description: "List all Cloudflare zones (domains) in this account.",
      inputSchema: z.object({}),
      execute: () =>
        safely("list_zones", async () => {
          const zones = await deps.listZones();
          return { count: zones.length, zones: zones.slice(0, MAX_ZONES) };
        }),
    }),

    list_groups: tool({
      description: "List zone groups and the zones in each group.",
      inputSchema: z.object({}),
      execute: () =>
        safely("list_groups", async () => {
          const [groups, zones] = await Promise.all([listGroups(deps.db), deps.listZones()]);
          const names = new Map(zones.map((z) => [z.id, z.name]));
          return {
            groups: groups.map((g) => ({
              id: g.id,
              name: g.name,
              description: g.description ?? null,
              zones: g.zoneIds.map((id) => names.get(id) ?? id),
            })),
          };
        }),
    }),

    get_dns_records: tool({
      description: "Get the DNS records of one zone.",
      inputSchema: z.object({
        zone: z.string().describe("Zone name (example.com) or zone id."),
      }),
      execute: ({ zone }) =>
        safely("get_dns_records", async () => {
          const ref = await resolveZone(deps, zone);
          const records = await getDNSRecords(deps.cf, ref.id);
          return {
            zone: ref.name,
            count: records.length,
            truncated: records.length > MAX_DNS_RECORDS,
            records: records.slice(0, MAX_DNS_RECORDS).map((r) => ({
              type: r.type,
              name: r.name,
              content: r.content,
              proxied: r.proxied,
              ttl: r.ttl,
            })),
          };
        }),
    }),

    get_waf_rules: tool({
      description: "Get the custom WAF rules deployed on a zone or on every zone in a group.",
      inputSchema: z.object({
        target: z.string().describe("A group name or a zone name (example.com)."),
      }),
      execute: ({ target }) =>
        safely("get_waf_rules", async () => {
          const group = await findGroup(deps, target);
          const zoneRefs = group
            ? await zonesForGroup(deps, group)
            : [await resolveZone(deps, target)];

          const perZone = await Promise.all(
            zoneRefs.slice(0, MAX_WAF_ZONES).map(async (ref) => {
              try {
                const ruleset = await getWAFRules(deps.cf, ref.id);
                return {
                  zone: ref.name,
                  rules: ruleset.rules.map((r) => ({
                    description: r.description ?? "",
                    action: r.action,
                    enabled: r.enabled ?? true,
                    expression: r.expression,
                  })),
                };
              } catch (err) {
                return { zone: ref.name, error: errorMessage(err) };
              }
            }),
          );

          return {
            target: group ? group.name : zoneRefs[0].name,
            kind: group ? "group" : "zone",
            zoneCount: zoneRefs.length,
            truncated: zoneRefs.length > MAX_WAF_ZONES,
            zones: perZone,
          };
        }),
    }),

    get_deployment_log: tool({
      description: "Get the most recent WAF rule deployments made from this app.",
      inputSchema: z.object({
        limit: looseInt.optional().describe("How many entries, 1-50. Default 20."),
      }),
      execute: ({ limit }) =>
        safely("get_deployment_log", async () => {
          const entries = await getDeploymentLog(deps.db, Math.min(Math.max(limit ?? 20, 1), 50));
          return {
            entries: entries.map((e) => ({
              zone: e.zoneName,
              rule: e.ruleName,
              action: e.action,
              status: e.status,
              error: e.errorMessage ?? null,
              at: e.createdAt,
            })),
          };
        }),
    }),

    get_traffic_analytics: tool({
      description:
        "Get traffic totals (requests, bytes, cache hit ratio, threats) for the whole account, one group or one zone.",
      inputSchema: z.object({
        scope: z.enum(["account", "group", "zone"]),
        name: z.string().optional().describe("Group or zone name. Not used for account scope."),
        range: rangeSchema,
      }),
      execute: ({ scope, name, range }) =>
        safely("get_traffic_analytics", async () => {
          const r = rangeOrDefault(range);
          if (scope === "account") {
            const a = await getAccountAnalytics(deps.db, r);
            return {
              scope,
              range: r,
              totals: roundTotals(a.totals),
              topZonesByRequests: topByRequests(a.perZone),
              lastFetchedAt: a.lastFetchedAt,
            };
          }
          if (!name) throw new Error(`A ${scope} name is required.`);
          if (scope === "group") {
            const group = await resolveGroup(deps, name);
            const g = await getGroupAnalytics(deps.db, group.id, r);
            if (!g) throw new Error(`No analytics for group "${name}".`);
            return {
              scope,
              range: r,
              group: g.groupName,
              totals: roundTotals(g.totals),
              topZonesByRequests: topByRequests(g.perZone),
              lastFetchedAt: g.lastFetchedAt,
            };
          }
          const zone = await resolveZone(deps, name);
          const z = await getZoneAnalytics(deps.db, zone.id, r);
          return { scope, range: r, zone: zone.name, totals: roundTotals(z.totals), lastFetchedAt: z.lastFetchedAt };
        }),
    }),

    get_top_error_zones: tool({
      description: "Rank zones by number of HTTP error responses (4xx or 5xx).",
      inputSchema: z.object({
        statusClass: z.enum(["4xx", "5xx"]),
        range: rangeSchema,
      }),
      execute: ({ statusClass, range }) =>
        safely("get_top_error_zones", async () => {
          const r = rangeOrDefault(range);
          const prefix = statusClass.charAt(0);
          const zones = await deps.listZones();
          const rows = await Promise.all(
            zones.map(async (zone) => {
              const agg = await getDimensionAggregate(deps.db, { kind: "zone", id: zone.id }, "status", r);
              const items = agg?.kind === "status" ? agg.items : [];
              const total = items.reduce((sum, i) => sum + i.requests, 0);
              const errors = items
                .filter((i) => i.key.startsWith(prefix))
                .reduce((sum, i) => sum + i.requests, 0);
              return { zone: zone.name, errors, requests: total };
            }),
          );
          const ranked = rows
            .filter((row) => row.errors > 0)
            .sort((a, b) => b.errors - a.errors)
            .slice(0, TOP_N)
            .map((row) => ({
              ...row,
              errorRate: row.requests > 0 ? Number((row.errors / row.requests).toFixed(4)) : 0,
            }));
          return { statusClass, range: r, zonesChecked: zones.length, zones: ranked };
        }),
    }),

    create_dns_record: tool({
      description:
        "Create one NEW DNS record in a zone. The user must approve this in the UI. Never use it to delete, update or replace a record.",
      inputSchema: z.object({
        zone: z.string().describe("Zone name (example.com) or zone id."),
        type: z.enum(DNS_RECORD_TYPES),
        name: z.string().describe("Record name, for example www or www.example.com."),
        content: z.string().describe("Record value, for example an IP address or hostname."),
        proxied: looseBoolean.optional(),
        ttl: looseInt.optional().describe("Seconds. 1 means automatic."),
        priority: looseInt.optional().describe("Required for MX records."),
      }),
      needsApproval: (input) => !createdRecordKeys.has(dnsRecordKey(input)),
      execute: ({ zone, ...record }) =>
        safely("create_dns_record", async () => {
          const key = dnsRecordKey({ zone, ...record });
          if (createdRecordKeys.has(key)) {
            return { zone, alreadyCreated: true, note: "This record was already created for this request. Nothing changed." };
          }
          const parsed = createDNSRecordSchema.safeParse(record);
          if (!parsed.success) {
            throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
          }
          const ref = await resolveZone(deps, zone);
          const created = await createRecord(deps.cf, ref.id, parsed.data);
          createdRecordKeys.add(key);
          return {
            zone: ref.name,
            created: { id: created.id, type: created.type, name: created.name, content: created.content },
          };
        }),
    }),
  };
}

async function zonesForGroup(deps: ToolDeps, group: Group): Promise<ZoneRef[]> {
  const zones = await deps.listZones();
  const names = new Map(zones.map((z) => [z.id, z.name]));
  return group.zoneIds.map((id) => ({ id, name: names.get(id) ?? id }));
}

function topByRequests(perZone: Array<{ zoneId: string; zoneName?: string; requests: number; threats: number }>) {
  return [...perZone]
    .sort((a, b) => b.requests - a.requests)
    .slice(0, TOP_N)
    .map((z) => ({ zone: z.zoneName ?? z.zoneId, requests: z.requests, threats: z.threats }));
}
