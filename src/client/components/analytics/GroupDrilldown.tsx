import type { AnalyticsRange, GroupAnalytics } from "../../types";
import { formatBytes, formatCount, formatPercent } from "../../lib/format";
import { MetricCard } from "./MetricCard";
import { TimeRangePicker } from "./TimeRangePicker";
import { SortableZoneTable } from "./SortableZoneTable";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { EmptyState } from "../shared/EmptyState";

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
          <SortableZoneTable rows={data.perZone} onRowClick={onSelectZone} />
        )}
      </section>
    </div>
  );
}

function Dot() {
  return <span className="block w-2 h-2 rounded-full bg-current" />;
}
