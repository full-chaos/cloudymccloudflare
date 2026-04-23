import type { RuleTemplate } from "../../types";
import { ActionBadge } from "./ActionBadge";

interface TemplatePickerProps {
  templates: Record<string, RuleTemplate>;
  selectedTemplateKey: string;
  onSelectedTemplateKeyChange: (key: string) => void;
}

export function TemplatePicker({
  templates,
  selectedTemplateKey,
  onSelectedTemplateKeyChange,
}: TemplatePickerProps) {
  const selectedTemplate: RuleTemplate | null = selectedTemplateKey
    ? templates[selectedTemplateKey]
    : null;

  return (
    <div className="bg-bg-secondary border border-border rounded-[10px] p-5 space-y-4">
      <h2 className="text-sm font-semibold font-display text-text-primary">
        Template Selection
      </h2>
      <div>
        <select
          value={selectedTemplateKey}
          onChange={(e) => onSelectedTemplateKeyChange(e.target.value)}
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
  );
}
