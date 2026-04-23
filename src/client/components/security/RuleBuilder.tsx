import type { Zone, Group, RuleAction, RuleTemplate } from "../../types";
import { TargetSelector, type TargetMode } from "./TargetSelector";
import { TemplatePicker } from "./TemplatePicker";
import { CustomRuleForm } from "./CustomRuleForm";
import { DeployPanel, type DeployMode } from "./DeployPanel";

interface RuleBuilderProps {
  zones: Zone[];
  groups: Group[];
  templates: Record<string, RuleTemplate>;

  targetMode: TargetMode;
  selectedZoneIds: string[];
  selectedGroupId: string;
  onTargetModeChange: (mode: TargetMode) => void;
  onToggleZone: (zoneId: string) => void;
  onSelectAllZones: () => void;
  onClearZoneSelection: () => void;
  onSelectedGroupIdChange: (groupId: string) => void;

  selectedTemplateKey: string;
  onSelectedTemplateKeyChange: (key: string) => void;

  customName: string;
  customExpression: string;
  customAction: RuleAction;
  onCustomNameChange: (name: string) => void;
  onCustomExpressionChange: (expression: string) => void;
  onCustomActionChange: (action: RuleAction) => void;

  deployMode: DeployMode;
  deploying: boolean;
  ruleCount: number;
  targetSummary: string;
  onDeployModeChange: (mode: DeployMode) => void;
  onDeploy: () => void;
}

export function RuleBuilder({
  zones,
  groups,
  templates,
  targetMode,
  selectedZoneIds,
  selectedGroupId,
  onTargetModeChange,
  onToggleZone,
  onSelectAllZones,
  onClearZoneSelection,
  onSelectedGroupIdChange,
  selectedTemplateKey,
  onSelectedTemplateKeyChange,
  customName,
  customExpression,
  customAction,
  onCustomNameChange,
  onCustomExpressionChange,
  onCustomActionChange,
  deployMode,
  deploying,
  ruleCount,
  targetSummary,
  onDeployModeChange,
  onDeploy,
}: RuleBuilderProps) {
  return (
    <div className="space-y-4">
      <TargetSelector
        zones={zones}
        groups={groups}
        targetMode={targetMode}
        selectedZoneIds={selectedZoneIds}
        selectedGroupId={selectedGroupId}
        onTargetModeChange={onTargetModeChange}
        onToggleZone={onToggleZone}
        onSelectAllZones={onSelectAllZones}
        onClearZoneSelection={onClearZoneSelection}
        onSelectedGroupIdChange={onSelectedGroupIdChange}
      />
      <TemplatePicker
        templates={templates}
        selectedTemplateKey={selectedTemplateKey}
        onSelectedTemplateKeyChange={onSelectedTemplateKeyChange}
      />
      <CustomRuleForm
        name={customName}
        expression={customExpression}
        action={customAction}
        onNameChange={onCustomNameChange}
        onExpressionChange={onCustomExpressionChange}
        onActionChange={onCustomActionChange}
      />
      <DeployPanel
        deployMode={deployMode}
        deploying={deploying}
        ruleCount={ruleCount}
        targetSummary={targetSummary}
        onDeployModeChange={onDeployModeChange}
        onDeploy={onDeploy}
      />
    </div>
  );
}
