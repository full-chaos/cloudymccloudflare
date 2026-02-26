import { useState } from "react";
import type { RuleTemplate, RuleAction, ToastType } from "../../types";
import { RULE_TEMPLATES } from "../../../shared/constants";

const ACTION_LABEL: Record<RuleAction, string> = {
  block: "Block",
  managed_challenge: "Managed Challenge",
  js_challenge: "JS Challenge",
  challenge: "Challenge",
  skip: "Skip",
  log: "Log",
};

const ACTION_STYLES: Record<RuleAction, string> = {
  block: "bg-red-500/10 text-red-400 border-red-500/20",
  managed_challenge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  js_challenge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  challenge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  skip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  log: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

interface TemplateCardProps {
  templateKey: string;
  template: RuleTemplate;
  isExpanded: boolean;
  onToggle: () => void;
  onCopy: (text: string) => void;
  onDeploy: (key: string) => void;
}

function TemplateCard({
  templateKey,
  template,
  isExpanded,
  onToggle,
  onCopy,
  onDeploy,
}: TemplateCardProps) {
  return (
    <div
      className={`
        bg-bg-secondary border rounded-[10px] overflow-hidden transition-all duration-200
        ${isExpanded ? "border-accent/30" : "border-border hover:border-border-hover"}
      `}
    >
      {/* Card header */}
      <button
        className="w-full p-4 text-left flex items-start gap-3"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold font-display text-text-primary">
              {template.name}
            </span>
            <span
              className={`text-[10px] font-mono font-semibold border px-1.5 py-0.5 rounded ${
                ACTION_STYLES[template.action]
              }`}
            >
              {ACTION_LABEL[template.action]}
            </span>
          </div>
          <p className="text-xs font-display text-text-secondary leading-relaxed">
            {template.description}
          </p>
        </div>
        <div
          className={`text-text-muted transition-transform flex-shrink-0 mt-0.5 ${
            isExpanded ? "rotate-90" : ""
          }`}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-border">
          {/* Expression code block */}
          <div>
            <div className="flex items-center justify-between mb-1.5 pt-3">
              <span className="text-[10px] font-display font-semibold text-text-muted uppercase tracking-wider">
                Expression
              </span>
              <button
                onClick={() => onCopy(template.expression)}
                className="text-[10px] font-display text-accent hover:text-accent/80 transition-colors flex items-center gap-1"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                  <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
                </svg>
                Copy
              </button>
            </div>
            <div className="bg-bg-primary border border-border rounded-lg p-3 overflow-x-auto">
              <code className="text-[11px] font-mono text-emerald-400 whitespace-pre-wrap break-all leading-relaxed">
                {template.expression}
              </code>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onCopy(template.expression)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-display font-medium text-text-secondary bg-bg-tertiary border border-border rounded-lg hover:border-border-hover hover:text-text-primary transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
              </svg>
              Copy Expression
            </button>
            <button
              onClick={() => onDeploy(templateKey)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg btn-primary transition-all"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z" />
              </svg>
              Deploy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface TemplatesViewProps {
  onNavigateToSecurity: (templateKey?: string) => void;
  onToast: (message: string, type?: ToastType) => void;
}

export function TemplatesView({ onNavigateToSecurity, onToast }: TemplatesViewProps) {
  const templates = RULE_TEMPLATES;
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEntries = Object.entries(templates).filter(([, tpl]) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tpl.name.toLowerCase().includes(q) ||
      tpl.description.toLowerCase().includes(q) ||
      tpl.action.toLowerCase().includes(q) ||
      tpl.expression.toLowerCase().includes(q)
    );
  });

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      onToast("Expression copied to clipboard", "success");
    } catch {
      onToast("Failed to copy to clipboard", "error");
    }
  }

  function handleDeploy(key: string) {
    onNavigateToSecurity(key);
  }

  const actionCounts = Object.values(templates).reduce<Record<string, number>>((acc, t) => {
    acc[t.action] = (acc[t.action] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 max-w-[1400px] space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold font-display text-text-primary">
            Rule Templates
          </h1>
          <p className="text-xs font-display text-text-secondary mt-0.5">
            Pre-built security rules ready to deploy to any zone or group.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-52">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
            </svg>
          </div>
          <input
            type="search"
            placeholder="Filter templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-display"
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 flex items-center gap-2">
          <span className="text-xs font-display text-text-secondary">Total</span>
          <span className="text-xs font-mono font-semibold text-text-primary">
            {Object.keys(templates).length}
          </span>
        </div>
        {Object.entries(actionCounts).map(([action, count]) => (
          <div
            key={action}
            className="bg-bg-secondary border border-border rounded-lg px-3 py-1.5 flex items-center gap-2"
          >
            <span
              className={`text-[10px] font-mono font-semibold border px-1.5 py-0.5 rounded ${
                ACTION_STYLES[action as RuleAction]
              }`}
            >
              {ACTION_LABEL[action as RuleAction] ?? action}
            </span>
            <span className="text-xs font-mono text-text-muted">{count}</span>
          </div>
        ))}
      </div>

      {/* Template Grid */}
      {filteredEntries.length === 0 ? (
        <div className="bg-bg-secondary border border-border rounded-[10px] py-12 text-center">
          <p className="text-sm font-display text-text-secondary">
            No templates match "{searchQuery}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredEntries.map(([key, template]) => (
            <TemplateCard
              key={key}
              templateKey={key}
              template={template}
              isExpanded={expandedKey === key}
              onToggle={() => setExpandedKey(expandedKey === key ? null : key)}
              onCopy={handleCopy}
              onDeploy={handleDeploy}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <p className="text-[11px] font-display text-text-muted text-center pb-2">
        Click a template to expand details. Use "Deploy" to navigate to Security Rules with the template pre-selected.
      </p>
    </div>
  );
}
