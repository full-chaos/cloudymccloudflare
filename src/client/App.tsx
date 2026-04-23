import { useState, useCallback, useMemo } from "react";
import type { ViewType, CreateDNSInput, DNSRecord } from "./types";
import { AppShell } from "./components/layout/AppShell";
import { DashboardView } from "./components/dashboard/DashboardView";
import { GroupsView } from "./components/groups/GroupsView";
import { DNSView } from "./components/dns/DNSView";
import { SecurityView } from "./components/security/SecurityView";
import { TemplatesView } from "./components/templates/TemplatesView";
import { AnalyticsView } from "./components/analytics/AnalyticsView";
import { ToastContainer } from "./components/shared/Toast";
import { useToast } from "./hooks/useToast";
import { useZones } from "./hooks/useZones";
import { useGroups } from "./hooks/useGroups";
import { useDNSRecords } from "./hooks/useDNSRecords";
import { useSecurityRules } from "./hooks/useSecurityRules";

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>("dashboard");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | undefined>(undefined);
  const [securityTemplateKey, setSecurityTemplateKey] = useState<string | undefined>(undefined);

  // Hooks
  const { toasts, addToast, removeToast } = useToast();
  const {
    zones,
    filteredZones,
    loading: zonesLoading,
    searchQuery,
    setSearchQuery,
  } = useZones();

  const {
    groups,
    loading: groupsLoading,
    createGroup,
    deleteGroup,
    addZoneToGroup,
    removeZoneFromGroup,
  } = useGroups();

  const {
    records,
    loading: recordsLoading,
    currentZoneId,
    fetchRecords,
    createRecord,
    deleteRecord,
  } = useDNSRecords();

  const {
    deployLog,
    deploying,
    deployToZones,
    deployToGroup,
    clearLog,
  } = useSecurityRules();

  // Navigation handler
  const handleNavigate = useCallback((view: ViewType) => {
    setCurrentView(view);
    // Clear template key when navigating away from security
    if (view !== "security") {
      setSecurityTemplateKey(undefined);
    }
  }, []);

  // Navigate to DNS for a specific zone
  const handleNavigateToDNS = useCallback(
    (zoneId: string) => {
      setSelectedZoneId(zoneId);
      setCurrentView("dns");
      fetchRecords(zoneId);
    },
    [fetchRecords]
  );

  // Navigate to security with optional template pre-selected
  const handleNavigateToSecurity = useCallback(
    (templateKey?: string) => {
      if (templateKey) setSecurityTemplateKey(templateKey);
      setCurrentView("security");
    },
    []
  );

  // Zone select in DNS view
  const handleSelectZone = useCallback(
    (zoneId: string) => {
      setSelectedZoneId(zoneId);
      fetchRecords(zoneId);
    },
    [fetchRecords]
  );

  // Group select from sidebar — filter DNS zones to the group and jump to its first zone
  const handleGroupSelect = useCallback(
    (groupId: string) => {
      setSelectedGroupId(groupId);
      const group = groups.find((g) => g.id === groupId);
      const firstZoneId = group?.zoneIds[0];
      if (firstZoneId) {
        setSelectedZoneId(firstZoneId);
        fetchRecords(firstZoneId);
      } else {
        setSelectedZoneId(null);
      }
    },
    [groups, fetchRecords]
  );

  // Zones visible in DNS view — filtered to the selected group, or all zones if none
  const dnsZones = useMemo(() => {
    if (!selectedGroupId) return zones;
    const group = groups.find((g) => g.id === selectedGroupId);
    return group ? zones.filter((z) => group.zoneIds.includes(z.id)) : zones;
  }, [zones, groups, selectedGroupId]);

  const handleClearGroupFilter = useCallback(() => {
    setSelectedGroupId(undefined);
  }, []);

  // DNS operations
  const handleCreateRecord = useCallback(
    async (zoneId: string, input: CreateDNSInput): Promise<DNSRecord> => {
      return createRecord(zoneId, input);
    },
    [createRecord]
  );

  const handleDeleteRecord = useCallback(
    async (zoneId: string, recordId: string): Promise<void> => {
      return deleteRecord(zoneId, recordId);
    },
    [deleteRecord]
  );

  // Render the active view
  function renderView() {
    switch (currentView) {
      case "dashboard":
        return (
          <DashboardView
            zones={filteredZones}
            groups={groups}
            loading={zonesLoading}
            onNavigateToDNS={handleNavigateToDNS}
          />
        );

      case "groups":
        return (
          <GroupsView
            groups={groups}
            zones={zones}
            loading={groupsLoading}
            onCreateGroup={createGroup}
            onDeleteGroup={deleteGroup}
            onAddZone={addZoneToGroup}
            onRemoveZone={removeZoneFromGroup}
            onToast={addToast}
          />
        );

      case "dns":
        return (
          <DNSView
            zones={dnsZones}
            groups={groups}
            records={records}
            loadingRecords={recordsLoading}
            addingRecord={false}
            currentZoneId={selectedZoneId ?? currentZoneId}
            activeGroupId={selectedGroupId}
            onSelectZone={handleSelectZone}
            onCreateRecord={handleCreateRecord}
            onDeleteRecord={handleDeleteRecord}
            onClearGroupFilter={handleClearGroupFilter}
            onToast={addToast}
          />
        );

      case "security":
        return (
          <SecurityView
            zones={zones}
            groups={groups}
            deployLog={deployLog}
            deploying={deploying}
            onDeployToZones={deployToZones}
            onDeployToGroup={deployToGroup}
            onClearLog={clearLog}
            onToast={addToast}
          />
        );

      case "templates":
        return (
          <TemplatesView
            onNavigateToSecurity={handleNavigateToSecurity}
            onToast={addToast}
          />
        );

      case "analytics":
        return (
          <AnalyticsView
            zones={zones}
            groups={groups}
            onToast={addToast}
          />
        );

      default:
        return null;
    }
  }

  return (
    <>
      <AppShell
        currentView={currentView}
        onNavigate={handleNavigate}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        groups={groups}
        zones={zones}
        onGroupSelect={handleGroupSelect}
        selectedGroupId={selectedGroupId}
      >
        {renderView()}
      </AppShell>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
