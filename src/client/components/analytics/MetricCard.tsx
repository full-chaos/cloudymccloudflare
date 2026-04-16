import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  accent?: string;
  loading?: boolean;
}

/**
 * Stat card for analytics totals. Mirrors the DashboardView StatCard style
 * but tuned for analytics: value takes priority, label is smaller, optional
 * sub-line under the label for context (e.g. "sampled" or a percentage).
 */
export function MetricCard({
  label,
  value,
  sub,
  icon,
  accent = "#f97316",
  loading = false,
}: MetricCardProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-[10px] p-5 flex items-start gap-4 hover:border-border-hover transition-colors">
      {icon && (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${accent}18` }}
        >
          <span style={{ color: accent }}>{icon}</span>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-2xl font-bold font-display text-text-primary leading-none mb-1">
          {loading ? (
            <span className="inline-block w-16 h-5 bg-bg-tertiary rounded animate-pulse" />
          ) : (
            value
          )}
        </p>
        <p className="text-xs font-display text-text-secondary">{label}</p>
        {sub && <p className="text-[10px] font-display text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
