import { useState } from "react";
import type { Zone, Group, RuleTemplate, CustomRule, RuleAction } from "../../types";
import type { DeployLogEntry, ToastType } from "../../types";
import { RULE_TEMPLATES } from "../../../shared/constants";
import { EmptyState } from "../shared/EmptyState";

const ACTION_COLORS: Record<RuleAction, { bg: string; text: string; border: string }> = {
  block: { bg: "#ef4444/15", text: "#ef4444", border: "#ef4444/30" },
  managed_challenge: { bg: "#f97316/15", text: "#f97316", border: "#f97316/30" },
  js_challenge: { bg: "#eab308/15", text: "#eab308", border: "#eab308/30" },
  challenge: { bg: "#8b5cf6/15", text: "#8b5cf6", border: "#8b5cf6/30" },
  skip: { bg: "#10b981/15", text: "#10b981", border: "#10b981/30" },
  log: { bg: "#6366f1/15", text: "#6366f1", border: "#6366f1/30" },
};

function ActionBadge({ action }: { action: RuleAction }) {
  const label = action.replace(/_/g, " ");
  const colorMap: Record<RuleAction, string> = {
    block: "bg-red-500/10 text-red-400 border-red-500/20",
    managed_challenge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    js_challenge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    challenge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    skip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    log: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${colorMap[action]}`}
    >
      {label}
    </span>
  );
}

function LogStatusDot({ status }: { status: DeployLogEntry["status"] }) {
  const colorMap = {
    queued: "bg-yellow-400 animate-pulse",
    deployed: "bg-emerald-400",
    error: "bg-red-400",
  };
  return <div className={`w-2 h-2 rounded-full flex-shrink-0 ${colorMap[status]}`} />;
}

interface SecurityViewProps {
  zones: Zone[];
  groups: Group[];
  deployLog: DeployLogEntry[];
  deploying: boolean;
  onDeployToZones: (
    zoneIds: string[],
    rules: CustomRule[],
    mode?: "append" | "replace"
  ) => Promise<void>;
  onDeployToGroup: (
    groupId: string,
    rules: CustomRule[],
    mode?: "append" | "replace"
  ) => Promise<void>;
  onClearLog: () => void;
  onToast: (message: string, type?: ToastType) => void;
}

export function SecurityView({
  zones,
  groups,
  deployLog,
  deploying,
  onDeployToZones,
  onDeployToGroup,
  onClearLog,
  onToast,
}: SecurityViewProps) {
  const templates = RULE_TEMPLATES;

  // Target selection
  const [targetMode, setTargetMode] = useState<"zones" | "group">("zones");
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  // Template selection
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("");
  const selectedTemplate: RuleTemplate | null = selectedTemplateKey
    ? templates[selectedTemplateKey]
    : null;

  // Custom rule
  const [customName, setCustomName] = useState("");
  const [customExpression, setCustomExpression] = useState("");
  const [customAction, setCustomAction] = useState<RuleAction>("block");

  // Deploy mode
  const [deployMode, setDeployMode] = useState<"append" | "replace">("append");

  // Expanded template preview
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  function toggleZone(zoneId: string) {
    setSelectedZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  }

  function selectAllZones() {
    setSelectedZoneIds(zones.map((z) => z.id));
  }

  function clearZoneSelection() {
    setSelectedZoneIds([]);
  }

  function buildRules(): CustomRule[] {
    const rules: CustomRule[] = [];

    if (selectedTemplate) {
      rules.push({
        expression: selectedTemplate.expression,
        action: selectedTemplate.action,
        description: selectedTemplate.name,
        enabled: true,
      });
    }

    if (customExpression.trim() && customName.trim()) {
      rules.push({
        expression: customExpression.trim(),
        action: customAction,
        description: customName.trim(),
        enabled: true,
      });
    }

    return rules;
  }

  async function handleDeploy() {
    const rules = buildRules();
    if (rules.length === 0) {
      onToast("Select a template or create a custom rule", "warning");
      return;
    }

    if (targetMode === "zones" && selectedZoneIds.length === 0) {
      onToast("Select at least one zone", "warning");
      return;
    }
    if (targetMode === "group" && !selectedGroupId) {
      onToast("Select a group", "warning");
      return;
    }

    try {
      if (targetMode === "zones") {
        await onDeployToZones(selectedZoneIds, rules, deployMode);
      } else {
        await onDeployToGroup(selectedGroupId, rules, deployMode);
      }
      onToast(`Deploying ${rules.length} rule(s)...`, "info");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Deploy failed", "error");
    }
  }

  return (
    <div className="p-6 max-w-[1400px]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        {/* Left Column: Config */}
        <div className="space-y-4">
          {/* Target Selection */}
          <div className="bg-bg-secondary border border-border rounded-[10px] p-5 space-y-4">
            <h2 className="text-sm font-semibold font-display text-text-primary">
              Target Selection
            </h2>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 bg-bg-tertiary border border-border rounded-lg p-1 w-fit">
              {(["zones", "group"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setTargetMode(mode)}
                  className={`px-4 py-1.5 text-xs font-display font-medium rounded-md capitalize transition-all ${
                    targetMode === mode
                      ? "bg-accent text-white shadow"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {mode === "zones" ? "Individual Zones" : "Group"}
                </button>
              ))}
            </div>

            {targetMode === "zones" ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-display text-text-secondary">
                    {selectedZoneIds.length} of {zones.length} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAllZones}
                      className="text-xs font-display text-accent hover:text-accent/80 transition-colors"
                    >
                      All
                    </button>
                    <span className="text-text-muted">·</span>
                    <button
                      onClick={clearZoneSelection}
                      className="text-xs font-display text-text-muted hover:text-text-secondary transition-colors"
                    >
                      None
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
                  {zones.map((zone) => {
                    const sel = selectedZoneIds.includes(zone.id);
                    return (
                      <button
                        key={zone.id}
                        onClick={() => toggleZone(zone.id)}
                        className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-all ${
                          sel
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border bg-bg-tertiary text-text-secondary hover:border-border-hover hover:text-text-primary"
                        }`}
                      >
                        {zone.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-display text-text-secondary mb-1.5">
                  Select Group
                </label>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent/50 font-display"
                >
                  <option value="">Choose a group...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.zoneIds.length} zones)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Template Selection */}
          <div className="bg-bg-secondary border border-border rounded-[10px] p-5 space-y-4">
            <h2 className="text-sm font-semibold font-display text-text-primary">
              Template Selection
            </h2>
            <div>
              <select
                value={selectedTemplateKey}
                onChange={(e) => setSelectedTemplateKey(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent/50 font-display"
              >
                <option value="">Choose a template...</option>
                {Object.entries(templates).map(([key, tpl]) => (
                  <option key={key} value={key}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Template preview */}
            {selectedTemplate && (
              <div className="bg-bg-tertiary border border-border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold font-display text-text-primary">
                      {selectedTemplate.name}
                    </p>
                    <p className="text-xs font-display text-text-secondary mt-1">
                      {selectedTemplate.description}
                    </p>
                  </div>
                  <ActionBadge action={selectedTemplate.action} />
                </div>
                <div className="bg-bg-primary rounded border border-border p-3">
                  <code className="text-[11px] font-mono text-emerald-400 break-all leading-relaxed">
                    {selectedTemplate.expression}
                  </code>
                </div>
              </div>
            )}
          </div>

          {/* Custom Rule Builder */}
          <div className="bg-bg-secondary border border-border rounded-[10px] p-5 space-y-4">
            <h2 className="text-sm font-semibold font-display text-text-primary">
              Custom Rule
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-display text-text-secondary mb-1.5">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g., Block Suspicious IPs"
                  className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-display"
                />
              </div>
              <div>
                <label className="block text-xs font-display text-text-secondary mb-1.5">
                  Expression
                </label>
                <textarea
                  value={customExpression}
                  onChange={(e) => setCustomExpression(e.target.value)}
                  placeholder='(ip.src eq "1.2.3.4")'
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-display text-text-secondary mb-1.5">
                  Action
                </label>
                <select
                  value={customAction}
                  onChange={(e) => setCustomAction(e.target.value as RuleAction)}
                  className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent/50 font-display"
                >
                  <option value="block">Block</option>
                  <option value="managed_challenge">Managed Challenge</option>
                  <option value="js_challenge">JS Challenge</option>
                  <option value="challenge">Challenge</option>
                  <option value="skip">Skip</option>
                  <option value="log">Log</option>
                </select>
              </div>
            </div>
          </div>

          {/* Deploy */}
          <div className="bg-bg-secondary border border-border rounded-[10px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold font-display text-text-primary">
                Deploy
              </h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <span className="text-xs font-display text-text-muted">Mode:</span>
                  <select
                    value={deployMode}
                    onChange={(e) => setDeployMode(e.target.value as "append" | "replace")}
                    className="text-xs bg-bg-tertiary border border-border rounded px-2 py-1 text-text-secondary focus:outline-none focus:border-accent/50 font-display"
                  >
                    <option value="append">Append</option>
                    <option value="replace">Replace</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Deploy summary */}
            <div className="text-xs font-display text-text-muted space-y-1">
              <div>
                Rules:{" "}
                <span className="text-text-secondary">
                  {buildRules().length} selected
                </span>
              </div>
              <div>
                Target:{" "}
                <span className="text-text-secondary">
                  {targetMode === "zones"
                    ? `${selectedZoneIds.length} zone(s)`
                    : selectedGroupId
                    ? `Group: ${groups.find((g) => g.id === selectedGroupId)?.name ?? "..."}`
                    : "None"}
                </span>
              </div>
            </div>

            <button
              onClick={handleDeploy}
              disabled={deploying || buildRules().length === 0}
              className="w-full py-2.5 text-sm font-semibold text-white rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {deploying ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Deploying...
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z" />
                  </svg>
                  Deploy Rules
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Deployment Log */}
        <div className="space-y-4">
          <div className="bg-bg-secondary border border-border rounded-[10px] overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-xs font-semibold font-display text-text-secondary uppercase tracking-wider">
                Deployment Log
              </h2>
              {deployLog.length > 0 && (
                <button
                  onClick={onClearLog}
                  className="text-[10px] font-display text-text-muted hover:text-text-secondary transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {deployLog.length === 0 ? (
              <EmptyState
                icon="◈"
                title="No deployments yet"
                description="Deploy a rule to see the log."
                className="py-10"
              />
            ) : (
              <div className="max-h-[600px] overflow-y-auto divide-y divide-border">
                {deployLog.map((entry) => (
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
                        className={`text-[10px] font-display flex-shrink-0 ${
                          entry.status === "deployed"
                            ? "text-emerald-400"
                            : entry.status === "error"
                            ? "text-red-400"
                            : "text-yellow-400"
                        }`}
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
        </div>
      </div>
    </div>
  );
}
