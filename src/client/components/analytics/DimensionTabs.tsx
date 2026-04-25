export const DIMENSION_OPTIONS = [
  { value: "country", label: "Geography" },
  { value: "status", label: "Status" },
  { value: "protocol", label: "Connection" },
  { value: "firewall", label: "Firewall" },
] as const;

export type Dim = (typeof DIMENSION_OPTIONS)[number]["value"];

export function isDimension(v: string): v is Dim {
  return DIMENSION_OPTIONS.some((o) => o.value === v);
}

export interface DimensionTabsProps {
  active: Dim;
  onChange: (next: Dim) => void;
  ariaLabel?: string;
}

export function DimensionTabs({ active, onChange, ariaLabel }: DimensionTabsProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex rounded-lg border border-border bg-bg-tertiary p-0.5"
    >
      {DIMENSION_OPTIONS.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
              isActive
                ? "bg-accent/10 text-accent"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
