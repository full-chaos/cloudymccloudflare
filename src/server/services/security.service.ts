import { eq, desc } from "drizzle-orm";
import { nanoid } from "../utils/nanoid";
import type { CloudflareClient } from "./cloudflare";
import type { Database } from "../db";
import { deploymentLog } from "../db/schema";
import type { CFRuleset, CFRule } from "../types/cloudflare";
import type { DeployRulesInput } from "@shared/validators";
import type { DeploymentLogEntry } from "@shared/types";

// ─── WAF / Firewall ───────────────────────────────────────────────────────────

export async function getWAFRules(
  cf: CloudflareClient,
  zoneId: string
): Promise<CFRuleset> {
  return cf.getCustomWAFRules(zoneId);
}

// ─── Deploy Rules ─────────────────────────────────────────────────────────────

export interface DeployResult {
  zoneId: string;
  zoneName: string;
  status: "success" | "failed";
  errorMessage?: string;
}

type NormalizedRule = {
  id?: string;
  expression: string;
  action: DeployRulesInput["rules"][number]["action"];
  description: string;
  enabled: boolean;
};

export async function deployRules(
  cf: CloudflareClient,
  db: Database,
  target: DeployRulesInput["target"],
  rules: NormalizedRule[],
  mode: DeployRulesInput["mode"],
  zoneNameMap: Record<string, string> = {}
): Promise<DeployResult[]> {
  const { type, ids } = target;

  // Resolve zone IDs from target
  let zoneIds: string[] = [];

  if (type === "zones") {
    zoneIds = ids;
  } else if (type === "group") {
    // Caller is responsible for resolving group -> zoneIds
    // ids[0] is the group ID; the actual zone IDs are passed as zoneIds already resolved
    // When called from routes, zoneIds will already be resolved from the group
    zoneIds = ids;
  }

  // Convert our rule format to CF rule format
  const cfRules: CFRule[] = rules.map((r) => ({
    id: r.id,
    action: r.action,
    expression: r.expression,
    description: r.description,
    enabled: r.enabled ?? true,
  }));

  const results = await cf.batchZoneOperation(zoneIds, async (zoneId) => {
    if (mode === "replace") {
      return cf.setCustomWAFRules(zoneId, cfRules);
    } else {
      // Append mode: fetch existing rules and append
      const existing = await cf.getCustomWAFRules(zoneId);
      const merged = [...existing.rules, ...cfRules];
      return cf.setCustomWAFRules(zoneId, merged);
    }
  });

  // Write deployment log entries
  const deployResults: DeployResult[] = [];

  for (const { zoneId, result, error } of results) {
    const zoneName = zoneNameMap[zoneId] ?? zoneId;
    const status = error ? "failed" : "success";

    // Log each rule separately for auditability
    for (const rule of rules) {
      await db.insert(deploymentLog).values({
        id: nanoid(),
        zoneId,
        zoneName,
        ruleType: "custom_waf",
        ruleName: rule.description,
        action: rule.action,
        details: JSON.stringify({ mode, expression: rule.expression }),
        status,
        errorMessage: error ?? null,
      });
    }

    deployResults.push({
      zoneId,
      zoneName,
      status,
      errorMessage: error,
    });
  }

  return deployResults;
}

// ─── Deployment Log ───────────────────────────────────────────────────────────

export async function getDeploymentLog(
  db: Database,
  limit = 100
): Promise<DeploymentLogEntry[]> {
  const rows = await db
    .select()
    .from(deploymentLog)
    .orderBy(desc(deploymentLog.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    zoneId: row.zoneId,
    zoneName: row.zoneName,
    ruleType: row.ruleType,
    ruleName: row.ruleName,
    action: row.action as DeploymentLogEntry["action"],
    details: row.details ?? undefined,
    status: row.status as DeploymentLogEntry["status"],
    errorMessage: row.errorMessage ?? undefined,
    createdAt: row.createdAt,
  }));
}
