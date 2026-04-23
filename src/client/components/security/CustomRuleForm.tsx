import type { RuleAction } from "../../types";

interface CustomRuleFormProps {
  name: string;
  expression: string;
  action: RuleAction;
  onNameChange: (name: string) => void;
  onExpressionChange: (expression: string) => void;
  onActionChange: (action: RuleAction) => void;
}

export function CustomRuleForm({
  name,
  expression,
  action,
  onNameChange,
  onExpressionChange,
  onActionChange,
}: CustomRuleFormProps) {
  return (
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
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g., Block Suspicious IPs"
            className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-display"
          />
        </div>
        <div>
          <label className="block text-xs font-display text-text-secondary mb-1.5">
            Expression
          </label>
          <textarea
            value={expression}
            onChange={(e) => onExpressionChange(e.target.value)}
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
            value={action}
            onChange={(e) => onActionChange(e.target.value as RuleAction)}
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
  );
}
