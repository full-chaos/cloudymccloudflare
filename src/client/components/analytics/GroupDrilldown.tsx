import { useState, useMemo } from "react";
import type { AnalyticsRange, GroupAnalytics } from "../../types";
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

type Metric = "requests" | "bytes" | "cachedBytes" | "threats";

const METRIC_TABS: Array<{ value: Metric; label: string }> = [
  { value: "requests", label: "Requests" },
  { value: "bytes", label: "Bandwidth" },
  { value: "cachedBytes", label: "Cached" },
  { value: "threats", label: "Threats" },
];

interface GroupDrilldownProps {
  data: GroupAnalytics | null;
  loading: boolean;
  error: string | null;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  onSelectZone: (zoneId: string) => void;
  onBack: () => void;
  onRefresh: () => void;
}

export function GroupDrilldown({
  data,
  loading,
  error,
  range,
  onRangeChange,
  onSelectZone,
  onBack,
  onRefresh,
}: GroupDrilldownProps) {
  const [metric, setMetric] = useState<Metric>("requests");

  const binnedSeries = useMemo(() => {
    if (!data) return [];
    return binSeriesIfNeeded(data.series, range);
  }, [data, range]);

  const binnedPerZone = useMemo(() => {
    if (!data) return {};
    return binSeriesByKeyIfNeeded(data.perZoneSeries ?? {}, range);
  }, [data, range]);

  const keyLabels = useMemo(() => {
    if (!data) return {};
    return Object.fromEntries(data.perZone.map(z => [z.zoneId, z.zoneName ?? z.zoneId]));
  }, [data]);

  const topZonesData = useMemo(() => {
    if (!data) return [];
    return data.perZone.map(z => ({ id: z.zoneId, label: z.zoneName ?? z.zoneId, value: z.requests }));
  }, [data]);

  if (loading && !data) {
    return <LoadingSpinner message="Loading group analytics…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠"
        title="Couldn't load group analytics"
        description={error}
        action={{ label: "Try again", onClick: onRefresh }}
      />
    );
  }

  if (!data) {
    return (
      <EmptyState
        icon="◇"
        title="Group not found"
        description="It may have been deleted while you were viewing it."
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
          <h1 className="text-xl font-semibold font-display text-text-primary">
            {data.groupName}
          </h1>
          <p className="text-xs font-display text-text-muted mt-1">
            {data.zoneCount} zone{data.zoneCount !== 1 ? "s" : ""} in group
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
            Group Trend
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
          Per-Zone Composition
        </h2>
        <StackedAreaChart
          seriesByKey={binnedPerZone}
          keyLabels={keyLabels}
          metric={metric}
        />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-bg-secondary border border-border rounded-[10px] p-4">
          <h2 className="text-sm font-semibold font-display text-text-primary mb-4">
            Top Zones in Group
          </h2>
          <TopNBarChart
            data={topZonesData}
            accent="#f97316"
            formatValue={formatCount}
            n={10}
            onItemClick={onSelectZone}
            ariaLabel="Top zones in group"
          />
        </section>
        <section className="bg-bg-secondary border border-border rounded-[10px] p-4 flex flex-col">
          <h2 className="text-sm font-semibold font-display text-text-primary mb-4">
            Cache Performance
          </h2>
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon="◇"
              title="Coming soon"
              description="Cache scatter plot will be added in a future update."
            />
          </div>
        </section>
      </div>

      <section>
        <h2 className="text-sm font-semibold font-display text-text-primary mb-3">
          Zones in this group
        </h2>
        {data.perZone.length === 0 ? (
          <EmptyState
            icon="◇"
            title="No zones in this group"
            description="Add zones via the Groups view to see their analytics here."
          />
        ) : (
          <SortableZoneTable
            rows={data.perZone}
            onRowClick={onSelectZone}
            seriesByZoneId={data.perZoneSeries}
            sparklineMetric="requests"
          />
        )}
      </section>
    </div>
  );
}

function Dot() {
  return <span className="block w-2 h-2 rounded-full bg-current" />;
}
