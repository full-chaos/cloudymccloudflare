import { useMemo } from "react";
import type { Zone, Group } from "../../types";
import type { DomainCluster } from "../../types";
import { LoadingOverlay } from "../shared/LoadingSpinner";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: string;
  sub?: string;
}

function StatCard({ label, value, icon, accent = "#f97316", sub }: StatCardProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-[10px] p-5 flex items-start gap-4 hover:border-border-hover transition-colors">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${accent}18` }}
      >
        <span style={{ color: accent }}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold font-display text-text-primary leading-none mb-1">
          {value}
        </p>
        <p className="text-xs font-display text-text-secondary">{label}</p>
        {sub && <p className="text-[10px] font-display text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

interface ClusterCardProps {
  cluster: DomainCluster;
  onZoneClick: (zone: Zone) => void;
}

function ClusterCard({ cluster, onZoneClick }: ClusterCardProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-[10px] p-4 hover:border-border-hover transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold font-display text-text-primary">
          {cluster.baseName}
        </h3>
        <span className="text-[10px] font-mono text-text-muted bg-bg-tertiary border border-border rounded px-1.5 py-0.5">
          {cluster.zones.length} TLD{cluster.zones.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {cluster.zones.map((zone) => {
          const tld = zone.name.slice(zone.name.indexOf("."));
          return (
            <button
              key={zone.id}
              onClick={() => onZoneClick(zone)}
              className="text-xs font-mono px-2 py-1 rounded border border-border bg-bg-tertiary hover:border-accent/40 hover:text-accent hover:bg-accent/5 text-text-secondary transition-all"
              title={zone.name}
            >
              {tld}
            </button>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-border flex items-center gap-1.5">
        <div
          className={`w-1.5 h-1.5 rounded-full ${
            cluster.zones.some((z) => z.status === "active")
              ? "bg-emerald-500"
              : "bg-yellow-500"
          }`}
        />
        <span className="text-[10px] font-display text-text-muted">
          {cluster.zones.filter((z) => z.status === "active").length} active
        </span>
      </div>
    </div>
  );
}

interface DashboardViewProps {
  zones: Zone[];
  groups: Group[];
  loading: boolean;
  onNavigateToDNS: (zoneId: string) => void;
}

export function DashboardView({
  zones,
  groups,
  loading,
  onNavigateToDNS,
}: DashboardViewProps) {
  const clusters = useMemo((): DomainCluster[] => {
    const map = new Map<string, Zone[]>();

    for (const zone of zones) {
      const parts = zone.name.split(".");
      // Base name = everything before the last TLD portion
      // e.g., "chrisgeorge.tech" -> base "chrisgeorge"
      // "chrisgeorgephotography.com" -> base "chrisgeorgephotography"
      // "dave-gregory.com" -> base "dave-gregory"
      const dotIdx = zone.name.indexOf(".");
      const base = dotIdx !== -1 ? zone.name.slice(0, dotIdx) : zone.name;

      if (!map.has(base)) map.set(base, []);
      map.get(base)!.push(zone);
    }

    // Only include clusters with at least 2 zones (true clusters)
    // Or include all if there's only one zone per base (show all)
    return Array.from(map.entries())
      .map(([baseName, clusterZones]) => ({ baseName, zones: clusterZones }))
      .sort((a, b) => b.zones.length - a.zones.length);
  }, [zones]);

  const groupedZoneIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of groups) {
      for (const id of group.zoneIds) ids.add(id);
    }
    return ids;
  }, [groups]);

  const groupedCount = groupedZoneIds.size;
  const ungroupedCount = zones.length - groupedCount;

  if (loading) {
    return <LoadingOverlay message="Loading zones..." />;
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Domains"
          value={zones.length}
          accent="#f97316"
          icon={
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm7.5-6.923c-.67.204-1.335.82-1.887 1.855-.143.268-.276.56-.395.872.705.157 1.472.257 2.282.287V1.077zM4.249 3.539c.142-.384.304-.744.481-1.078a6.7 6.7 0 0 1 .597-.933A7.01 7.01 0 0 0 3.051 3.05c.362.184.763.349 1.198.49zM3.509 7.5c.036-1.07.188-2.087.436-3.008a9.124 9.124 0 0 1-1.565-.667A6.964 6.964 0 0 0 1.018 7.5h2.49zm1.4-2.741a12.344 12.344 0 0 0-.4 2.741H7.5V5.091c-.91-.03-1.783-.145-2.591-.332zM8.5 5.09V7.5h2.99a12.342 12.342 0 0 0-.399-2.741c-.808.187-1.681.301-2.591.332zM4.51 8.5c.035.987.176 1.914.399 2.741A13.612 13.612 0 0 1 7.5 10.91V8.5H4.51zm3.99 0v2.409c.91.03 1.783.145 2.591.332.223-.827.364-1.754.4-2.741H8.5zm-3.282 3.696c.12.312.252.604.395.872.552 1.035 1.218 1.65 1.887 1.855V11.91c-.81.03-1.577.13-2.282.287zm.11 2.276a6.696 6.696 0 0 1-.598-.933 8.853 8.853 0 0 1-.481-1.079 8.38 8.38 0 0 0-1.198.49 7.01 7.01 0 0 0 2.276 1.522zm-1.383-2.964A13.36 13.36 0 0 1 3.508 8.5h-2.49a6.963 6.963 0 0 0 1.362 3.675c.47-.258.995-.482 1.565-.667zm6.728 2.964a7.009 7.009 0 0 0 2.275-1.521 8.376 8.376 0 0 0-1.197-.49 8.853 8.853 0 0 1-.481 1.078 6.688 6.688 0 0 1-.597.933zM8.5 11.909v3.014c.67-.204 1.335-.82 1.887-1.855.143-.268.276-.56.395-.872A12.63 12.63 0 0 0 8.5 11.91zm3.555-.401c.57.185 1.095.409 1.565.667A6.963 6.963 0 0 0 14.982 8.5h-2.49a13.36 13.36 0 0 1-.437 3.008zM14.982 7.5a6.963 6.963 0 0 0-1.362-3.675c-.47.258-.995.482-1.565.667.248.92.4 1.938.437 3.008h2.49z" />
            </svg>
          }
        />
        <StatCard
          label="Groups"
          value={groups.length}
          accent="#8b5cf6"
          icon={
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
              <path fillRule="evenodd" d="M5.216 14A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216z" />
              <path d="M4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
            </svg>
          }
        />
        <StatCard
          label="Grouped"
          value={groupedCount}
          accent="#06b6d4"
          sub={`${zones.length > 0 ? Math.round((groupedCount / zones.length) * 100) : 0}% of domains`}
          icon={
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1 2.828c.885-.37 2.154-.769 3.388-.893 1.33-.134 2.458.063 3.112.752v9.746c-.935-.53-2.12-.603-3.213-.493-1.18.12-2.37.461-3.287.811V2.828zm7.5-.141c.654-.689 1.782-.886 3.112-.752 1.234.124 2.503.523 3.388.893v9.923c-.918-.35-2.107-.692-3.287-.81-1.094-.111-2.278-.039-3.213.492V2.687zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z" />
            </svg>
          }
        />
        <StatCard
          label="Ungrouped"
          value={ungroupedCount}
          accent="#ef4444"
          sub="no group assigned"
          icon={
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.5 3a2.5 2.5 0 0 1 5 0v9a1.5 1.5 0 0 1-3 0V5a.5.5 0 0 1 1 0v7a.5.5 0 0 0 1 0V3a1.5 1.5 0 1 0-3 0v9a2.5 2.5 0 0 0 5 0V5a.5.5 0 0 1 1 0v7a3.5 3.5 0 1 1-7 0V3z" />
            </svg>
          }
        />
      </div>

      {/* Domain Clusters */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold font-display text-text-primary">
            Domain Clusters
          </h2>
          <span className="text-xs font-mono text-text-muted">
            {clusters.length} base{clusters.length !== 1 ? "s" : ""}
          </span>
        </div>

        {clusters.length === 0 ? (
          <div className="bg-bg-secondary border border-border rounded-[10px] p-12 text-center">
            <p className="text-text-muted font-display text-sm">
              No zones available. Check your Cloudflare connection.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {clusters.map((cluster) => (
              <ClusterCard
                key={cluster.baseName}
                cluster={cluster}
                onZoneClick={(zone) => onNavigateToDNS(zone.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Groups overview */}
      {groups.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold font-display text-text-primary">
              Active Groups
            </h2>
            <span className="text-xs font-mono text-text-muted">
              {groups.length} group{groups.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {groups.map((group) => (
              <div
                key={group.id}
                className="bg-bg-secondary border border-border rounded-[10px] p-4 hover:border-border-hover transition-colors"
              >
                <div className="flex items-center gap-2.5 mb-3">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: group.color }}
                  />
                  <span className="text-sm font-semibold font-display text-text-primary truncate">
                    {group.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-display text-text-muted">
                    {group.zoneIds.length} zone{group.zoneIds.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex gap-1">
                    {group.zoneIds.slice(0, 3).map((zoneId) => {
                      const zone = zones.find((z) => z.id === zoneId);
                      if (!zone) return null;
                      const tld = zone.name.slice(zone.name.indexOf("."));
                      return (
                        <span
                          key={zoneId}
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border text-text-muted"
                        >
                          {tld}
                        </span>
                      );
                    })}
                    {group.zoneIds.length > 3 && (
                      <span className="font-mono text-[10px] px-1.5 py-0.5 text-text-muted">
                        +{group.zoneIds.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
