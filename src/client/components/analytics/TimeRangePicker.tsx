import type { AnalyticsRange } from "../../types";

interface TimeRangePickerProps {
  value: AnalyticsRange;
  onChange: (range: AnalyticsRange) => void;
  /** Max `sampleInterval` across the displayed data. If > 1, show sampled notice. */
  sampleInterval?: number;
  /** ISO timestamp of last backfill success, rendered relatively. */
  lastFetchedAt?: string | null;
}

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
];

export function TimeRangePicker({
  value,
  onChange,
  sampleInterval,
  lastFetchedAt,
}: TimeRangePickerProps) {
  const sampled = typeof sampleInterval === "number" && sampleInterval > 1;
  return (
    <div className="flex items-center gap-3">
      {sampled && (
        <span
          className="text-[10px] font-mono text-yellow-500/80 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1"
          title={`Cloudflare adaptively sampled at 1:${Math.round(sampleInterval!)} — totals are extrapolated.`}
        >
          sampled 1:{Math.round(sampleInterval!)}
        </span>
      )}
      {lastFetchedAt !== undefined && (
        <span className="text-[10px] font-mono text-text-muted">
          {lastFetchedAt ? `updated ${formatRelative(lastFetchedAt)}` : "never updated"}
        </span>
      )}
      <div className="inline-flex rounded-lg border border-border bg-bg-secondary p-0.5">
        {RANGES.map((r) => {
          const active = r.value === value;
          return (
            <button
              key={r.value}
              onClick={() => onChange(r.value)}
              className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                active
                  ? "bg-accent/10 text-accent"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const sec = Math.floor((Date.now() - then) / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
