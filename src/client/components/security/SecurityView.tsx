import { useMemo, useState } from "react";
import type { Zone, Group, CustomRule, RuleAction } from "../../types";
import type { DeployLogEntry, ToastType } from "../../types";
import { RULE_TEMPLATES } from "../../../shared/constants";
import { RuleBuilder } from "./RuleBuilder";
import { DeploymentLog } from "./DeploymentLog";
import type { TargetMode } from "./TargetSelector";
import type { DeployMode } from "./DeployPanel";

interface SecurityViewProps {
  zones: Zone[];
  groups: Group[];
  deployLog: DeployLogEntry[];
  deploying: boolean;
  onDeployToZones: (
    zoneIds: string[],
    rules: CustomRule[],
    mode?: DeployMode
  ) => Promise<void>;
  onDeployToGroup: (
    groupId: string,
    rules: CustomRule[],
    mode?: DeployMode
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

  const [targetMode, setTargetMode] = useState<TargetMode>("zones");
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("");

  const [customName, setCustomName] = useState("");
  const [customExpression, setCustomExpression] = useState("");
  const [customAction, setCustomAction] = useState<RuleAction>("block");

  const [deployMode, setDeployMode] = useState<DeployMode>("append");

  const toggleZone = (zoneId: string) =>
    setSelectedZoneIds((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );

  const selectAllZones = () => setSelectedZoneIds(zones.map((z) => z.id));
  const clearZoneSelection = () => setSelectedZoneIds([]);

  const rules = useMemo<CustomRule[]>(() => {
    const out: CustomRule[] = [];
    const tpl = selectedTemplateKey ? templates[selectedTemplateKey] : null;
    if (tpl) {
      out.push({
        expression: tpl.expression,
        action: tpl.action,
        description: tpl.name,
        enabled: true,
      });
    }
    if (customExpression.trim() && customName.trim()) {
      out.push({
        expression: customExpression.trim(),
        action: customAction,
        description: customName.trim(),
        enabled: true,
      });
    }
    return out;
  }, [
    selectedTemplateKey,
    templates,
    customExpression,
    customName,
    customAction,
  ]);

  const targetSummary = useMemo(() => {
    if (targetMode === "zones") {
      return `${selectedZoneIds.length} zone(s)`;
    }
    if (!selectedGroupId) return "None";
    const group = groups.find((g) => g.id === selectedGroupId);
    return `Group: ${group?.name ?? "..."}`;
  }, [targetMode, selectedZoneIds.length, selectedGroupId, groups]);

  async function handleDeploy() {
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
        <RuleBuilder
          zones={zones}
          groups={groups}
          templates={templates}
          targetMode={targetMode}
          selectedZoneIds={selectedZoneIds}
          selectedGroupId={selectedGroupId}
          onTargetModeChange={setTargetMode}
          onToggleZone={toggleZone}
          onSelectAllZones={selectAllZones}
          onClearZoneSelection={clearZoneSelection}
          onSelectedGroupIdChange={setSelectedGroupId}
          selectedTemplateKey={selectedTemplateKey}
          onSelectedTemplateKeyChange={setSelectedTemplateKey}
          customName={customName}
          customExpression={customExpression}
          customAction={customAction}
          onCustomNameChange={setCustomName}
          onCustomExpressionChange={setCustomExpression}
          onCustomActionChange={setCustomAction}
          deployMode={deployMode}
          deploying={deploying}
          ruleCount={rules.length}
          targetSummary={targetSummary}
          onDeployModeChange={setDeployMode}
          onDeploy={handleDeploy}
        />
        <div className="space-y-4">
          <DeploymentLog entries={deployLog} onClear={onClearLog} />
        </div>
      </div>
    </div>
  );
}
