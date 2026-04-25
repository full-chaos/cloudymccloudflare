import { useMemo, useState } from "react";
import type { AnalyticsRange, ClusterAnalytics } from "../../types";
import { formatBytes, formatCount, formatPercent } from "../../lib/format";
import { binSeriesIfNeeded, binSeriesByKeyIfNeeded } from "../../lib/timeseries";
import { MetricCard } from "./MetricCard";
import { TimeRangePicker } from "./TimeRangePicker";
import { SortableZoneTable } from "./SortableZoneTable";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { EmptyState } from "../shared/EmptyState";
import { RequestsChart } from "./RequestsChart";
import { StackedAreaChart } from "./StackedAreaChart";
import { TopNBarChart } from "./TopNBarChart";
import { DimensionsSection } from "./DimensionsSection";
import type { Dim } from "./DimensionTabs";

type Metric = "requests" | "bytes" | "cachedBytes" | "threats";

interface ClusterDrilldownProps {
  clusterName: string;
  data: ClusterAnalytics | null;
  loading: boolean;
  error: string | null;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  onSelectZone: (zoneId: string) => void;
  onBack: () => void;
  onRefresh: () => void;
  dim: Dim;
  onDimChange: (next: Dim) => void;
}

const METRIC_TABS: Array<{ value: Metric; label: string }> = [
  { value: "requests", label: "Requests" },
  { value: "bytes", label: "Bandwidth" },
  { value: "cachedBytes", label: "Cached" },
  { value: "threats", label: "Threats" },
];

export function ClusterDrilldown({
  clusterName,
  data,
  loading,
  error,
  range,
  onRangeChange,
  onSelectZone,
  onBack,
  onRefresh,
  dim,
  onDimChange,
}: ClusterDrilldownProps) {
  const [metric, setMetric] = useState<Metric>("requests");

  const binnedSeries = useMemo(() => {
    if (!data?.series) return [];
    return binSeriesIfNeeded(data.series, range);
  }, [data?.series, range]);

  const binnedPerZone = useMemo(() => {
    if (!data?.perZoneSeries) return {};
    return binSeriesByKeyIfNeeded(data.perZoneSeries, range);
  }, [data?.perZoneSeries, range]);

  if (loading && !data) {
    return <LoadingSpinner message="Loading cluster analytics…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠"
        title="Couldn't load cluster analytics"
        description={error}
        action={{ label: "Try again", onClick: onRefresh }}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon="◇"
        title="Cluster not found"
        description={`No zones match the base name "${clusterName}".`}
        action={{ label: "Back to overview", onClick: onBack }}
      />
    );
  }

  const t = data.totals;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={onBack}
            className="text-xs font-mono text-text-muted hover:text-accent transition-colors mb-2"
          >
            ← Account Overview
          </button>
          <h1 className="text-xl font-semibold font-display text-text-primary font-mono">
            {clusterName}
          </h1>
          <p className="text-xs font-display text-text-muted mt-1">
            {data.perZone.length} zone{data.perZone.length !== 1 ? "s" : ""} in cluster
          </p>
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
            Cluster trend
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
        <RequestsChart series={binnedSeries} metric={metric} />
      </section>

      <section className="bg-bg-secondary border border-border rounded-[10px] p-4">
        <h2 className="text-sm font-semibold font-display text-text-primary mb-4">
          Per-TLD composition
        </h2>
        <StackedAreaChart
          seriesByKey={binnedPerZone}
          keyLabels={Object.fromEntries(data.perZone.map(z => [z.zoneId, z.zoneName ?? z.zoneId]))}
          metric={metric}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-bg-secondary border border-border rounded-[10px] p-4">
          <h2 className="text-sm font-semibold font-display text-text-primary mb-4">
            Top TLDs in cluster
          </h2>
          <TopNBarChart
            data={data.perZone.map(z => ({ id: z.zoneId, label: z.zoneName ?? z.zoneId, value: z.requests }))}
            accent="#f97316"
            formatValue={formatCount}
            n={10}
            onItemClick={onSelectZone}
            ariaLabel="Top TLDs in cluster"
          />
        </section>
        <div className="hidden lg:block" />
      </div>

      <section>
        <h2 className="text-sm font-semibold font-display text-text-primary mb-3">
          Zones in this cluster
        </h2>
        <SortableZoneTable
          rows={data.perZone}
          onRowClick={onSelectZone}
          seriesByZoneId={data.perZoneSeries}
          sparklineMetric="requests"
        />
      </section>

      <DimensionsSection
        scope={{ kind: "cluster", id: clusterName }}
        range={range}
        dim={dim}
        onDimChange={onDimChange}
      />
    </div>
  );
}

function Dot() {
  return <span className="block w-2 h-2 rounded-full bg-current" />;
}
