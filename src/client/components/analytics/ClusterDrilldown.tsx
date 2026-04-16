import { useMemo } from "react";
import type {
  AccountAnalytics,
  AccountTotals,
  AnalyticsRange,
  Zone,
  ZoneMetrics,
} from "../../types";
import {
  computeCacheHitRatio,
  formatBytes,
  formatCount,
  formatPercent,
} from "../../lib/format";
import { toClusters } from "../../lib/clusters";
import { MetricCard } from "./MetricCard";
import { TimeRangePicker } from "./TimeRangePicker";
import { SortableZoneTable } from "./SortableZoneTable";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { EmptyState } from "../shared/EmptyState";

interface ClusterDrilldownProps {
  clusterName: string;
  account: AccountAnalytics | null;
  zones: Zone[];
  loading: boolean;
  error: string | null;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
  onSelectZone: (zoneId: string) => void;
  onBack: () => void;
  onRefresh: () => void;
}

/**
 * Cluster drilldown reuses the already-loaded account analytics rather than
 * firing a new request — cluster membership is pure client-side namespace math,
 * so we just filter the per-zone rows by the cluster's zone IDs.
 */
export function ClusterDrilldown({
  clusterName,
  account,
  zones,
  loading,
  error,
  range,
  onRangeChange,
  onSelectZone,
  onBack,
  onRefresh,
}: ClusterDrilldownProps) {
  const { clusterZones, perZone, totals } = useMemo(() => {
    const cluster = toClusters(zones).find((c) => c.baseName === clusterName);
    const clusterZones = cluster?.zones ?? [];
    const inCluster = new Set(clusterZones.map((z) => z.id));

    const trafficByZone = new Map(
      (account?.perZone ?? []).map((z) => [z.zoneId, z] as const),
    );

    // Preserve zones with zero traffic so users can see the full cluster,
    // not just the busy subset.
    const perZone: ZoneMetrics[] = clusterZones.map((z) => {
      const t = trafficByZone.get(z.id);
      return {
        zoneId: z.id,
        zoneName: z.name,
        requests: t?.requests ?? 0,
        bytes: t?.bytes ?? 0,
        cachedBytes: t?.cachedBytes ?? 0,
        threats: t?.threats ?? 0,
      };
    });

    const summed = perZone.reduce(
      (acc, z) => ({
        requests: acc.requests + z.requests,
        bytes: acc.bytes + z.bytes,
        cachedBytes: acc.cachedBytes + z.cachedBytes,
        threats: acc.threats + z.threats,
      }),
      { requests: 0, bytes: 0, cachedBytes: 0, threats: 0 },
    );

    const totals: AccountTotals = {
      ...summed,
      cacheHitRatio: computeCacheHitRatio(summed.bytes, summed.cachedBytes),
    };

    return { clusterZones, perZone, totals, inCluster };
  }, [clusterName, zones, account]);

  if (loading && !account) {
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

  if (clusterZones.length === 0) {
    return (
      <EmptyState
        icon="◇"
        title="Cluster not found"
        description={`No zones match the base name "${clusterName}".`}
        action={{ label: "Back to overview", onClick: onBack }}
      />
    );
  }

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
            {clusterZones.length} zone{clusterZones.length !== 1 ? "s" : ""} in cluster
          </p>
        </div>
        <TimeRangePicker
          value={range}
          onChange={onRangeChange}
          sampleInterval={account?.sampleInterval}
          lastFetchedAt={account?.lastFetchedAt ?? null}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <MetricCard label="Requests" value={formatCount(totals.requests)} accent="#f97316" icon={<Dot />} />
        <MetricCard label="Bandwidth" value={formatBytes(totals.bytes)} accent="#60a5fa" icon={<Dot />} />
        <MetricCard label="Cached" value={formatBytes(totals.cachedBytes)} accent="#34d399" icon={<Dot />} />
        <MetricCard
          label="Cache hit ratio"
          value={Number.isNaN(totals.cacheHitRatio) ? "—" : formatPercent(totals.cacheHitRatio, 1)}
          accent="#a78bfa"
          icon={<Dot />}
        />
        <MetricCard
          label="Threats"
          value={formatCount(totals.threats)}
          accent={totals.threats > 0 ? "#f87171" : "#555"}
          icon={<Dot />}
        />
      </div>

      <section>
        <h2 className="text-sm font-semibold font-display text-text-primary mb-3">
          Zones in this cluster
        </h2>
        <SortableZoneTable rows={perZone} onRowClick={onSelectZone} />
      </section>
    </div>
  );
}

function Dot() {
  return <span className="block w-2 h-2 rounded-full bg-current" />;
}
