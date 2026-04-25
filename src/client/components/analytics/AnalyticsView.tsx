import { useCallback, useEffect, useState } from "react";
import type { AnalyticsRange, Group, Zone } from "../../types";
import { api } from "../../lib/api";
import { useAccountAnalytics } from "../../hooks/useAccountAnalytics";
import { useGroupAnalytics } from "../../hooks/useGroupAnalytics";
import { useZoneAnalytics } from "../../hooks/useZoneAnalytics";
import { useClusterAnalytics } from "../../hooks/useClusterAnalytics";
import { AccountOverview } from "./AccountOverview";
import { GroupDrilldown } from "./GroupDrilldown";
import { ZoneDrilldown } from "./ZoneDrilldown";
import { ClusterDrilldown } from "./ClusterDrilldown";
import type { Dim } from "./DimensionTabs";

type SubView = "overview" | "group" | "cluster" | "zone";

interface AnalyticsViewProps {
  zones: Zone[];
  groups: Group[];
  onToast: (message: string, type?: "success" | "error" | "info") => void;
}

/**
 * Top-level analytics router.
 * Owns the {subView, selectedGroupId/ClusterName/ZoneId, range} state so
 * drilling down doesn't reset the range and "back" returns to the right place.
 */
export function AnalyticsView({ zones, groups, onToast }: AnalyticsViewProps) {
  const [subView, setSubView] = useState<SubView>("overview");
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedClusterName, setSelectedClusterName] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [cameFromGroup, setCameFromGroup] = useState(false);
  const [cameFromCluster, setCameFromCluster] = useState(false);
  const [range, setRange] = useState<AnalyticsRange>("24h");
  const [refreshing, setRefreshing] = useState(false);
  const [activeDim, setActiveDim] = useState<Dim>("country");

  const accountQuery = useAccountAnalytics(range);
  const groupQuery = useGroupAnalytics(selectedGroupId, range);
  const clusterQuery = useClusterAnalytics(selectedClusterName, range);
  const zoneQuery = useZoneAnalytics(selectedZoneId, range);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await api.analytics.refresh();
      onToast(
        `Refreshed — upserted ${result.rowsUpserted} hourly buckets across ${result.zonesQueried} zone${result.zonesQueried === 1 ? "" : "s"}.`,
        "success",
      );
      // Refetch whichever sub-view is currently active.
      await Promise.all([accountQuery.refresh(), groupQuery.refresh(), clusterQuery.refresh(), zoneQuery.refresh()]);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Refresh failed", "error");
    } finally {
      setRefreshing(false);
    }
  }, [accountQuery, groupQuery, clusterQuery, zoneQuery, onToast]);

  const handleSelectGroup = useCallback((groupId: string) => {
    setSelectedGroupId(groupId);
    setSubView("group");
    setCameFromGroup(true);
    setCameFromCluster(false);
  }, []);

  const handleSelectCluster = useCallback((clusterName: string) => {
    setSelectedClusterName(clusterName);
    setSubView("cluster");
    setCameFromCluster(true);
    setCameFromGroup(false);
  }, []);

  const handleSelectZone = useCallback(
    (zoneId: string) => {
      // Track which drilldown spawned the zone view so the back button
      // returns to the right place.
      setCameFromGroup(subView === "group");
      setCameFromCluster(subView === "cluster");
      setSelectedZoneId(zoneId);
      setSubView("zone");
    },
    [subView],
  );

  const handleBackToOverview = useCallback(() => {
    setSubView("overview");
    setSelectedGroupId(null);
    setSelectedClusterName(null);
    setSelectedZoneId(null);
    setCameFromGroup(false);
    setCameFromCluster(false);
  }, []);

  const handleBackFromZone = useCallback(() => {
    if (cameFromGroup && selectedGroupId) {
      setSubView("group");
      setSelectedZoneId(null);
    } else if (cameFromCluster && selectedClusterName) {
      setSubView("cluster");
      setSelectedZoneId(null);
    } else {
      handleBackToOverview();
    }
  }, [cameFromGroup, cameFromCluster, selectedGroupId, selectedClusterName, handleBackToOverview]);

  // ESC key pops one drilldown level at a time.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (subView === "zone") handleBackFromZone();
      else if (subView === "group" || subView === "cluster") handleBackToOverview();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [subView, handleBackFromZone, handleBackToOverview]);

  // Standard page chrome used across the app — matches DashboardView / GroupsView.
  const body = (() => {
    if (subView === "zone" && selectedZoneId) {
      const backLabel = cameFromGroup && groupQuery.data
        ? groupQuery.data.groupName
        : cameFromCluster && selectedClusterName
          ? selectedClusterName
          : "Account Overview";
      return (
        <ZoneDrilldown
          data={zoneQuery.data}
          loading={zoneQuery.loading}
          error={zoneQuery.error}
          range={range}
          onRangeChange={setRange}
          onBack={handleBackFromZone}
          backLabel={backLabel}
          onRefresh={zoneQuery.refresh}
          dim={activeDim}
          onDimChange={setActiveDim}
        />
      );
    }

    if (subView === "cluster" && selectedClusterName) {
      return (
        <ClusterDrilldown
          clusterName={selectedClusterName}
          data={clusterQuery.data}
          loading={clusterQuery.loading}
          error={clusterQuery.error}
          range={range}
          onRangeChange={setRange}
          onSelectZone={handleSelectZone}
          onBack={handleBackToOverview}
          onRefresh={clusterQuery.refresh}
          dim={activeDim}
          onDimChange={setActiveDim}
        />
      );
    }

    if (subView === "group" && selectedGroupId) {
      return (
        <GroupDrilldown
          data={groupQuery.data}
          loading={groupQuery.loading}
          error={groupQuery.error}
          range={range}
          onRangeChange={setRange}
          onSelectZone={handleSelectZone}
          onBack={handleBackToOverview}
          onRefresh={groupQuery.refresh}
          dim={activeDim}
          onDimChange={setActiveDim}
        />
      );
    }

    return (
      <AccountOverview
        data={accountQuery.data}
        groups={groups}
        zones={zones}
        loading={accountQuery.loading}
        error={accountQuery.error}
        range={range}
        onRangeChange={setRange}
        onSelectGroup={handleSelectGroup}
        onSelectCluster={handleSelectCluster}
        onSelectZone={handleSelectZone}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        dim={activeDim}
        onDimChange={setActiveDim}
      />
    );
  })();

  return <div className="p-6 space-y-6 max-w-[1400px]">{body}</div>;
}
