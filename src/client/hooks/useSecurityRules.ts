import { useState, useCallback } from "react";
import { api } from "../lib/api";
import type { CustomRule, DeployPayload, DeploymentLogEntry } from "../types";
import type { DeployLogEntry } from "../types";

export interface UseSecurityRulesReturn {
  deployLog: DeployLogEntry[];
  deploying: boolean;
  error: string | null;
  deployToZones: (
    zoneIds: string[],
    rules: CustomRule[],
    mode?: "append" | "replace"
  ) => Promise<void>;
  deployToGroup: (
    groupId: string,
    rules: CustomRule[],
    mode?: "append" | "replace"
  ) => Promise<void>;
  clearLog: () => void;
}

let logIdCounter = 0;

function makeLogId(): string {
  return `log-${++logIdCounter}-${Date.now()}`;
}

function toDeployLogEntry(entry: DeploymentLogEntry): DeployLogEntry {
  return {
    id: makeLogId(),
    zoneId: entry.zoneId,
    zoneName: entry.zoneName,
    ruleName: entry.ruleName,
    status:
      entry.status === "success"
        ? "deployed"
        : entry.status === "failed"
        ? "error"
        : "queued",
    timestamp: entry.createdAt || new Date().toISOString(),
    errorMessage: entry.errorMessage,
  };
}

function resolveQueuedDeployments(
  prev: DeployLogEntry[],
  results: DeploymentLogEntry[] | null | undefined,
): DeployLogEntry[] {
  if (results && results.length > 0) {
    const nextEntries = results.map(toDeployLogEntry);
    return [...nextEntries, ...prev.filter((entry) => entry.status !== "queued")];
  }

  return prev.map((entry) =>
    entry.status === "queued" ? { ...entry, status: "deployed" } : entry,
  );
}

export function useSecurityRules(): UseSecurityRulesReturn {
  const [deployLog, setDeployLog] = useState<DeployLogEntry[]>([]);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appendLog = useCallback(
    (entry: Omit<DeployLogEntry, "id" | "timestamp">) => {
      const logEntry: DeployLogEntry = {
        ...entry,
        id: makeLogId(),
        timestamp: new Date().toISOString(),
      };
      setDeployLog((prev) => [logEntry, ...prev]);
    },
    []
  );

  const deployToZones = useCallback(
    async (
      zoneIds: string[],
      rules: CustomRule[],
      mode: "append" | "replace" = "append"
    ): Promise<void> => {
      if (zoneIds.length === 0 || rules.length === 0) return;

      setDeploying(true);
      setError(null);

      const payload: DeployPayload = {
        target: { type: "zones", ids: zoneIds },
        rules,
        mode,
      };

      // Add queued entries
      zoneIds.forEach((zoneId) => {
        rules.forEach((rule) => {
          appendLog({
            zoneId,
            zoneName: zoneId,
            ruleName: rule.description || "Custom Rule",
            status: "queued",
          });
        });
      });

      try {
        const results = await api.security.deployBatch(payload);
        setDeployLog((prev) => resolveQueuedDeployments(prev, results));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Deployment failed";
        setError(errorMsg);
        setDeployLog((prev) =>
          prev.map((e) =>
            e.status === "queued"
              ? { ...e, status: "error", errorMessage: errorMsg }
              : e
          )
        );
        throw err;
      } finally {
        setDeploying(false);
      }
    },
    [appendLog]
  );

  const deployToGroup = useCallback(
    async (
      groupId: string,
      rules: CustomRule[],
      mode: "append" | "replace" = "append"
    ): Promise<void> => {
      if (!groupId || rules.length === 0) return;

      setDeploying(true);
      setError(null);

      const payload: DeployPayload = {
        target: { type: "group", id: groupId },
        rules,
        mode,
      };

      appendLog({
        zoneId: groupId,
        zoneName: `Group: ${groupId}`,
        ruleName: rules.map((r) => r.description || "Rule").join(", "),
        status: "queued",
      });

      try {
        const results = await api.security.deployBatch(payload);
        setDeployLog((prev) => resolveQueuedDeployments(prev, results));
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Deployment failed";
        setError(errorMsg);
        setDeployLog((prev) =>
          prev.map((e) =>
            e.status === "queued"
              ? { ...e, status: "error", errorMessage: errorMsg }
              : e
          )
        );
        throw err;
      } finally {
        setDeploying(false);
      }
    },
    [appendLog]
  );

  const clearLog = useCallback(() => {
    setDeployLog([]);
    setError(null);
  }, []);

  return {
    deployLog,
    deploying,
    error,
    deployToZones,
    deployToGroup,
    clearLog,
  };
}
