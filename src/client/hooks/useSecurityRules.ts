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
        // Update log entries based on results
        if (results && results.length > 0) {
          setDeployLog((prev) => {
            const newEntries = results.map(
              (r: DeploymentLogEntry): DeployLogEntry => ({
                id: makeLogId(),
                zoneId: r.zoneId,
                zoneName: r.zoneName,
                ruleName: r.ruleName,
                status:
                  r.status === "success"
                    ? "deployed"
                    : r.status === "failed"
                    ? "error"
                    : "queued",
                timestamp: r.createdAt || new Date().toISOString(),
                errorMessage: r.errorMessage,
              })
            );
            return [...newEntries, ...prev.filter((e) => e.status !== "queued")];
          });
        } else {
          // If no detailed results, mark queued as deployed
          setDeployLog((prev) =>
            prev.map((e) =>
              e.status === "queued" ? { ...e, status: "deployed" } : e
            )
          );
        }
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
        target: { type: "group", ids: [groupId] },
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
        if (results && results.length > 0) {
          setDeployLog((prev) => {
            const newEntries = results.map(
              (r: DeploymentLogEntry): DeployLogEntry => ({
                id: makeLogId(),
                zoneId: r.zoneId,
                zoneName: r.zoneName,
                ruleName: r.ruleName,
                status:
                  r.status === "success"
                    ? "deployed"
                    : r.status === "failed"
                    ? "error"
                    : "queued",
                timestamp: r.createdAt || new Date().toISOString(),
                errorMessage: r.errorMessage,
              })
            );
            return [...newEntries, ...prev.filter((e) => e.status !== "queued")];
          });
        } else {
          setDeployLog((prev) =>
            prev.map((e) =>
              e.status === "queued" ? { ...e, status: "deployed" } : e
            )
          );
        }
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
