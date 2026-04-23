import type { RuleAction } from "../../types";

const ACTION_COLOR_CLASSES: Record<RuleAction, string> = {
  block: "bg-red-500/10 text-red-400 border-red-500/20",
  managed_challenge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  js_challenge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  challenge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  skip: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  log: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
};

interface ActionBadgeProps {
  action: RuleAction;
}

export function ActionBadge({ action }: ActionBadgeProps) {
  const label = action.replace(/_/g, " ");
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${ACTION_COLOR_CLASSES[action]}`}
    >
      {label}
    </span>
  );
}
