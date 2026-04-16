import { useMemo } from "react";
import type {
  AccountAnalytics,
  AccountTotals,
  AnalyticsRange,
  DomainCluster,
  Group,
  Zone,
  ZoneMetrics,
} from "../../types";
import { computeCacheHitRatio, formatBytes, formatCount, formatPercent } from "../../lib/format";
import { toClusters } from "../../lib/clusters";
import { MetricCard } from "./MetricCard";
import { TimeRangePicker } from "./TimeRangePicker";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { EmptyState } from "../shared/EmptyState";

interface AccountOverviewProps {
  data: AccountAnalytics | null;
  groups: Group[];
  zones: Zone[];
  loading: boolean;
  error: string | null;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  onSelectGroup: (groupId: string) => void;
  onSelectCluster: (clusterName: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function AccountOverview({
  data,
  groups,
  zones,
  loading,
  error,
  range,
  onRangeChange,
  onSelectGroup,
  onSelectCluster,
  onRefresh,
  refreshing,
}: AccountOverviewProps) {
  const groupRollups = useMemo(() => aggregateByGroup(data?.perZone ?? [], groups), [data, groups]);
  const clusterRollups = useMemo(
    () => aggregateByCluster(data?.perZone ?? [], zones),
    [data, zones],
  );

  if (loading && !data) {
    return <LoadingSpinner message="Loading analytics…" />;
  }

  if (error) {
    return (
      <EmptyState
        icon="⚠"
        title="Couldn't load analytics"
        description={error}
        action={{ label: "Try again", onClick: onRefresh }}
      />
    );
  }

  if (!data || data.perZone.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Header
          title="Account Overview"
          range={range}
          onRangeChange={onRangeChange}
          sampleInterval={data?.sampleInterval}
          lastFetchedAt={data?.lastFetchedAt ?? null}
          onRefresh={onRefresh}
          refreshing={refreshing}
        />
        <EmptyState
          icon="◈"
          title="No analytics data yet"
          description="The backfill worker populates data every 15 minutes. Click Refresh to fetch now, or wait a few minutes for the first cron run."
          action={{ label: "Refresh now", onClick: onRefresh }}
        />
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="flex flex-col gap-6">
      <Header
        title="Account Overview"
        range={range}
        onRangeChange={onRangeChange}
        sampleInterval={data.sampleInterval}
        lastFetchedAt={data.lastFetchedAt}
        onRefresh={onRefresh}
        refreshing={refreshing}
      />

      {/* Top-level KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard
          label="Requests"
          value={formatCount(t.requests)}
          accent="#f97316"
          icon={<IconDot />}
        />
        <MetricCard
          label="Bandwidth"
          value={formatBytes(t.bytes)}
          accent="#60a5fa"
          icon={<IconDot />}
        />
        <MetricCard
          label="Cached"
          value={formatBytes(t.cachedBytes)}
          accent="#34d399"
          icon={<IconDot />}
        />
        <MetricCard
          label="Cache hit ratio"
          value={Number.isNaN(t.cacheHitRatio) ? "—" : formatPercent(t.cacheHitRatio, 1)}
          accent="#a78bfa"
          icon={<IconDot />}
        />
        <MetricCard
          label="Threats"
          value={formatCount(t.threats)}
          accent={t.threats > 0 ? "#f87171" : "#555"}
          icon={<IconDot />}
        />
      </div>

      {/* Per-group summaries */}
      <section>
        <h2 className="text-sm font-semibold font-display text-text-primary mb-3">
          By group <span className="text-text-muted font-normal">({groupRollups.length})</span>
        </h2>
        {groupRollups.length === 0 ? (
          <EmptyState
            icon="◇"
            title="No groups yet"
            description="Create groups from the Groups view to see per-group roll-ups here."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {groupRollups.map((g) => (
              <GroupSummaryCard
                key={g.key}
                entry={g}
                onClick={g.groupId ? () => onSelectGroup(g.groupId!) : undefined}
              />
            ))}
          </div>
        )}
      </section>

      {/* Per-cluster summaries — TLD/base-name namespace groupings computed from
          zones. Clusters are implicit: every zone belongs to exactly one. */}
      {clusterRollups.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold font-display text-text-primary mb-3">
            By cluster{" "}
            <span className="text-text-muted font-normal">({clusterRollups.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {clusterRollups.map((c) => (
              <ClusterSummaryCard
                key={c.name}
                entry={c}
                onClick={() => onSelectCluster(c.name)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

interface HeaderProps {
  title: string;
  range: AnalyticsRange;
  onRangeChange: (r: AnalyticsRange) => void;
  sampleInterval?: number;
  lastFetchedAt: string | null;
  onRefresh: () => void;
  refreshing?: boolean;
}

function Header({ title, range, onRangeChange, sampleInterval, lastFetchedAt, onRefresh, refreshing }: HeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <h1 className="text-xl font-semibold font-display text-text-primary">{title}</h1>
      <div className="flex items-center gap-3">
        <TimeRangePicker
          value={range}
          onChange={onRangeChange}
          sampleInterval={sampleInterval}
          lastFetchedAt={lastFetchedAt}
        />
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="px-3 py-1 text-xs font-mono rounded border border-border bg-bg-secondary text-text-secondary hover:text-accent hover:border-accent/40 disabled:opacity-50 transition-colors"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>
    </div>
  );
}

// ─── Group summary card ───────────────────────────────────────────────────────

interface GroupRollup {
  key: string;               // group id, or "__ungrouped__"
  groupId: string | null;    // null for the Ungrouped tile
  name: string;
  color: string | null;
  zoneCount: number;
  totals: AccountTotals;
}

interface GroupSummaryCardProps {
  entry: GroupRollup;
  onClick?: () => void;
}

function GroupSummaryCard({ entry, onClick }: GroupSummaryCardProps) {
  const ungrouped = entry.groupId === null;
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`text-left bg-bg-secondary border border-border rounded-[10px] p-4 transition-colors ${
        onClick ? "hover:border-accent/40 cursor-pointer" : "cursor-default opacity-85"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: entry.color ?? "#555" }}
          />
          <h3 className="text-sm font-semibold font-display text-text-primary truncate">
            {entry.name}
          </h3>
        </div>
        <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary border border-border rounded px-1.5 py-0.5">
          {entry.zoneCount} zone{entry.zoneCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Stat label="Requests" value={formatCount(entry.totals.requests)} />
        <Stat label="Bandwidth" value={formatBytes(entry.totals.bytes)} />
        <Stat label="Hit ratio" value={Number.isNaN(entry.totals.cacheHitRatio) ? "—" : formatPercent(entry.totals.cacheHitRatio, 0)} />
        <Stat
          label="Threats"
          value={formatCount(entry.totals.threats)}
          danger={entry.totals.threats > 0 && !ungrouped}
        />
      </div>
    </button>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div>
      <p className={`text-sm font-mono leading-none ${danger ? "text-red-400" : "text-text-primary"}`}>
        {value}
      </p>
      <p className="text-[10px] font-display text-text-muted mt-0.5">{label}</p>
    </div>
  );
}

function IconDot() {
  return <span className="block w-2 h-2 rounded-full bg-current" />;
}

// ─── Cluster summary card ─────────────────────────────────────────────────────

interface ClusterRollup {
  name: string;
  tldCount: number;      // number of zones in the cluster
  totals: AccountTotals;
}

interface ClusterSummaryCardProps {
  entry: ClusterRollup;
  onClick: () => void;
}

function ClusterSummaryCard({ entry, onClick }: ClusterSummaryCardProps) {
  return (
    <button
      onClick={onClick}
      className="text-left bg-bg-secondary border border-border rounded-[10px] p-4 transition-colors hover:border-accent/40 cursor-pointer"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold font-display text-text-primary font-mono truncate">
          {entry.name}
        </h3>
        <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary border border-border rounded px-1.5 py-0.5">
          {entry.tldCount} TLD{entry.tldCount !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <Stat label="Requests" value={formatCount(entry.totals.requests)} />
        <Stat label="Bandwidth" value={formatBytes(entry.totals.bytes)} />
        <Stat
          label="Hit ratio"
          value={
            Number.isNaN(entry.totals.cacheHitRatio)
              ? "—"
              : formatPercent(entry.totals.cacheHitRatio, 0)
          }
        />
        <Stat
          label="Threats"
          value={formatCount(entry.totals.threats)}
          danger={entry.totals.threats > 0}
        />
      </div>
    </button>
  );
}

// ─── Aggregation helpers ──────────────────────────────────────────────────────

const UNGROUPED_KEY = "__ungrouped__";

/**
 * Bucket per-zone metrics into groups. A zone in multiple groups contributes
 * to each group's totals (so group rollups are not mutually exclusive — each
 * group card stands alone). Zones in no groups end up in the "Ungrouped" tile.
 *
 * DECISION: sort by requests DESC (most active groups first). Ungrouped is
 * always pinned last so a high-traffic "Ungrouped" bucket doesn't drown out
 * real group rollups. Swap to alphabetical (`g.name.localeCompare`) if you
 * prefer stable-but-unordered layout.
 */
function aggregateByGroup(perZone: ZoneMetrics[], groups: Group[]): GroupRollup[] {
  const perZoneMap = new Map(perZone.map((z) => [z.zoneId, z] as const));
  const groupedZoneIds = new Set<string>();

  const groupRollups: GroupRollup[] = groups.map((g) => {
    const zoneMetrics = g.zoneIds
      .map((id) => {
        groupedZoneIds.add(id);
        return perZoneMap.get(id);
      })
      .filter((x): x is ZoneMetrics => x !== undefined);
    return {
      key: g.id,
      groupId: g.id,
      name: g.name,
      color: g.color,
      zoneCount: g.zoneIds.length,
      totals: summarize(zoneMetrics),
    };
  });

  groupRollups.sort((a, b) => b.totals.requests - a.totals.requests);

  // Ungrouped tile: zones with traffic but not in any group.
  const ungroupedMetrics = perZone.filter((z) => !groupedZoneIds.has(z.zoneId));
  if (ungroupedMetrics.length > 0) {
    groupRollups.push({
      key: UNGROUPED_KEY,
      groupId: null,
      name: "Ungrouped",
      color: null,
      zoneCount: ungroupedMetrics.length,
      totals: summarize(ungroupedMetrics),
    });
  }

  return groupRollups;
}

function summarize(zones: ZoneMetrics[]): AccountTotals {
  const totals = zones.reduce(
    (acc, z) => ({
      requests: acc.requests + z.requests,
      bytes: acc.bytes + z.bytes,
      cachedBytes: acc.cachedBytes + z.cachedBytes,
      threats: acc.threats + z.threats,
    }),
    { requests: 0, bytes: 0, cachedBytes: 0, threats: 0 },
  );
  return {
    ...totals,
    cacheHitRatio: computeCacheHitRatio(totals.bytes, totals.cachedBytes),
  };
}

/**
 * Bucket per-zone metrics into clusters (TLD namespaces computed from zone names).
 * Every zone belongs to exactly one cluster — unlike groups, clusters are
 * mutually exclusive. Sorted by requests DESC so busy clusters surface first.
 */
function aggregateByCluster(perZone: ZoneMetrics[], zones: Zone[]): ClusterRollup[] {
  const clusters: DomainCluster[] = toClusters(zones);
  const perZoneMap = new Map(perZone.map((z) => [z.zoneId, z] as const));
  const rollups = clusters.map((c) => {
    const metrics = c.zones
      .map((z) => perZoneMap.get(z.id))
      .filter((m): m is ZoneMetrics => m !== undefined);
    return {
      name: c.baseName,
      tldCount: c.zones.length,
      totals: summarize(metrics),
    };
  });
  rollups.sort((a, b) => b.totals.requests - a.totals.requests);
  return rollups;
}
