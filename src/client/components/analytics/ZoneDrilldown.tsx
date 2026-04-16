import { useState } from "react";
import type { AnalyticsRange, ZoneAnalytics } from "../../types";
import { formatBytes, formatCount, formatPercent } from "../../lib/format";
import { MetricCard } from "./MetricCard";
import { TimeRangePicker } from "./TimeRangePicker";
import { RequestsChart } from "./RequestsChart";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { EmptyState } from "../shared/EmptyState";

type Metric = "requests" | "bytes" | "cachedBytes" | "threats";

interface ZoneDrilldownProps {
  data: ZoneAnalytics | null;
  loading: boolean;
  error: string | null;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  onBack: () => void;
  backLabel: string;
  onRefresh: () => void;
}

const METRIC_TABS: Array<{ value: Metric; label: string }> = [
  { value: "requests", label: "Requests" },
  { value: "bytes", label: "Bandwidth" },
  { value: "cachedBytes", label: "Cached" },
  { value: "threats", label: "Threats" },
];

export function ZoneDrilldown({
  data,
  loading,
  error,
  range,
  onRangeChange,
  onBack,
  backLabel,
  onRefresh,
}: ZoneDrilldownProps) {
  const [metric, setMetric] = useState<Metric>("requests");

  if (loading && !data) {
    return <LoadingSpinner message="Loading zone analytics…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠"
        title="Couldn't load zone analytics"
        description={error}
        action={{ label: "Try again", onClick: onRefresh }}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon="◇"
        title="Zone not found"
        action={{ label: "Back", onClick: onBack }}
      />
    );
  }

  const t = data.totals;
  const zoneLabel = data.zoneName || data.zoneId.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-mono text-text-muted hover:text-accent transition-colors mb-2"
          >
            ← {backLabel}
          </button>
          <h1 className="text-xl font-semibold font-display text-text-primary font-mono">
            {zoneLabel}
          </h1>
          {data.zoneName && (
            <p className="text-[10px] font-mono text-text-muted mt-1">{data.zoneId}</p>
          )}
        </div>
        <TimeRangePicker
          value={range}
          onChange={onRangeChange}
          sampleInterval={data.sampleInterval}
          lastFetchedAt={data.lastFetchedAt}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Requests" value={formatCount(t.requests)} accent="#f97316" icon={<Dot />} />
        <MetricCard label="Bandwidth" value={formatBytes(t.bytes)} accent="#60a5fa" icon={<Dot />} />
        <MetricCard label="Cached" value={formatBytes(t.cachedBytes)} accent="#34d399" icon={<Dot />} />
        <MetricCard
          label="Cache hit ratio"
          value={Number.isNaN(t.cacheHitRatio) ? "—" : formatPercent(t.cacheHitRatio, 1)}
          accent="#a78bfa"
          icon={<Dot />}
        />
        <MetricCard
          label="Threats"
          value={formatCount(t.threats)}
          accent={t.threats > 0 ? "#f87171" : "#555"}
          icon={<Dot />}
        />
      </div>

      <section className="bg-bg-secondary border border-border rounded-[10px] p-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="text-sm font-semibold font-display text-text-primary">
            Hourly over last {range}
          </h2>
          <div className="inline-flex rounded-lg border border-border bg-bg-tertiary p-0.5">
            {METRIC_TABS.map((m) => {
              const active = m.value === metric;
              return (
                <button
                  key={m.value}
                  onClick={() => setMetric(m.value)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <RequestsChart series={data.series} metric={metric} />
      </section>
    </div>
  );
}

function Dot() {
  return <span className="block w-2 h-2 rounded-full bg-current" />;
}
