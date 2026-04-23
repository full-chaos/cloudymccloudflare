import type { DeployLogEntry } from "../../types";
import { EmptyState } from "../shared/EmptyState";
import { LogStatusDot } from "./LogStatusDot";

interface DeploymentLogProps {
  entries: DeployLogEntry[];
  onClear: () => void;
}

function statusClass(status: DeployLogEntry["status"]): string {
  switch (status) {
    case "deployed":
      return "text-emerald-400";
    case "error":
      return "text-red-400";
    default:
      return "text-yellow-400";
  }
}

export function DeploymentLog({ entries, onClear }: DeploymentLogProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-[10px] overflow-hidden sticky top-6">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h2 className="text-xs font-semibold font-display text-text-secondary uppercase tracking-wider">
          Deployment Log
        </h2>
        {entries.length > 0 && (
          <button
            onClick={onClear}
            className="text-[10px] font-display text-text-muted hover:text-text-secondary transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon="◈"
          title="No deployments yet"
          description="Deploy a rule to see the log."
          className="py-10"
        />
      ) : (
        <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
          {entries.map((entry) => (
            <div key={entry.id} className="px-4 py-3 space-y-1">
              <div className="flex items-start gap-2">
                <LogStatusDot status={entry.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-text-primary truncate">
                    {entry.zoneName}
                  </p>
                  <p className="text-[11px] font-display text-text-secondary truncate">
                    {entry.ruleName}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-display flex-shrink-0 ${statusClass(entry.status)}`}
                >
                  {entry.status}
                </span>
              </div>
              {entry.errorMessage && (
                <p className="text-[10px] font-mono text-red-400 ml-4 truncate">
                  {entry.errorMessage}
                </p>
              )}
              <p className="text-[10px] font-display text-text-muted ml-4">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
