import { useState, useEffect } from "react";
import type { Zone, Group, DNSRecord, CreateDNSInput } from "../../types";
import type { ToastType } from "../../types";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { EmptyState } from "../shared/EmptyState";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { AddRecordForm } from "./AddRecordForm";
import { DNSRecordsTable } from "./DNSRecordsTable";

interface DNSViewProps {
  zones: Zone[];
  groups: Group[];
  records: DNSRecord[];
  loadingRecords: boolean;
  error: string | null;
  addingRecord: boolean;
  currentZoneId: string | null;
  activeGroupId?: string;
  onSelectZone: (zoneId: string) => void;
  onCreateRecord: (zoneId: string, input: CreateDNSInput) => Promise<DNSRecord>;
  onBatchCreateRecords: (zoneIds: string[], input: CreateDNSInput) => Promise<void>;
  onDeleteRecord: (zoneId: string, recordId: string) => Promise<void>;
  onRetry: () => Promise<void>;
  onClearGroupFilter?: () => void;
  onToast: (message: string, type?: ToastType) => void;
}

export function DNSView({
  zones,
  groups,
  records,
  loadingRecords,
  error,
  currentZoneId,
  activeGroupId,
  onSelectZone,
  onCreateRecord,
  onBatchCreateRecords,
  onDeleteRecord,
  onRetry,
  onClearGroupFilter,
  onToast,
}: DNSViewProps) {
  const [batchMode, setBatchMode] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [addingRecord, setAddingRecord] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DNSRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currentZone = zones.find((z) => z.id === currentZoneId);
  const activeGroup = activeGroupId ? groups.find((g) => g.id === activeGroupId) : null;

  useEffect(() => {
    if (!currentZoneId && zones.length > 0) {
      onSelectZone(zones[0].id);
    }
  }, [zones, currentZoneId, onSelectZone]);

  async function handleAddRecord(input: CreateDNSInput) {
    if (!currentZoneId) return;
    setAddingRecord(true);
    try {
      if (batchMode) {
        const group = groups.find((g) => g.id === selectedGroupId);
        if (!group || group.zoneIds.length === 0) {
          throw new Error("Select a group with at least one zone for batch mode");
        }
        await onBatchCreateRecords(group.zoneIds, input);
        onToast(`DNS record added to ${group.zoneIds.length} zone(s)`, "success");
      } else {
        await onCreateRecord(currentZoneId, input);
        onToast("DNS record added", "success");
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to add record", "error");
    } finally {
      setAddingRecord(false);
    }
  }

  async function handleDeleteRecord() {
    if (!deleteTarget || !currentZoneId) return;
    setDeleting(true);
    try {
      await onDeleteRecord(currentZoneId, deleteTarget.id);
      onToast("DNS record deleted", "success");
      setDeleteTarget(null);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to delete record", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">
      {/* Zone List Sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-border bg-bg-primary overflow-y-auto">
        <div className="px-3 py-3 border-b border-border">
          <span className="text-[10px] font-semibold font-display text-text-muted uppercase tracking-wider">
            {activeGroup ? `${activeGroup.name} (${zones.length})` : `Zones (${zones.length})`}
          </span>
        </div>
        <div className="py-1">
          {zones.map((zone) => {
            const isActive = zone.id === currentZoneId;
            return (
              <button
                key={zone.id}
                onClick={() => onSelectZone(zone.id)}
                className={`
                  w-full text-left px-3 py-2.5 text-xs transition-all
                  ${
                    isActive
                      ? "text-accent bg-accent/5 border-r-2 border-accent font-medium"
                      : "text-text-secondary hover:text-text-primary hover:bg-bg-secondary"
                  }
                `}
              >
                <span className="font-mono block truncate">{zone.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Panel */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold font-display text-text-primary">
              {currentZone?.name ?? "Select a zone"}
            </h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {currentZone && (
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${
                      currentZone.status === "active" ? "bg-emerald-500" : "bg-yellow-500"
                    }`}
                  />
                  <span className="text-xs font-display text-text-muted capitalize">
                    {currentZone.status}
                  </span>
                </div>
              )}
              {activeGroup && (
                <span className="inline-flex items-center gap-1.5 pl-2 pr-1 py-0.5 rounded-full text-[11px] font-display bg-accent/10 border border-accent/20 text-accent">
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: activeGroup.color }}
                  />
                  <span>Filtered: {activeGroup.name}</span>
                  <button
                    type="button"
                    onClick={onClearGroupFilter}
                    className="ml-0.5 w-4 h-4 rounded-full flex items-center justify-center text-accent/70 hover:text-text-primary hover:bg-accent/20 transition-colors"
                    aria-label="Clear group filter"
                    title="Clear group filter"
                  >
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                      <path d="M1.146 1.146a.5.5 0 0 1 .708 0L4 3.293l2.146-2.147a.5.5 0 1 1 .708.708L4.707 4l2.147 2.146a.5.5 0 0 1-.708.708L4 4.707 1.854 6.854a.5.5 0 0 1-.708-.708L3.293 4 1.146 1.854a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </button>
                </span>
              )}
            </div>
          </div>

          {/* Batch Mode Toggle */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs font-display text-text-secondary">Batch Mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={batchMode}
                className={`relative w-8 h-4 rounded-full transition-colors ${
                  batchMode ? "bg-accent" : "bg-border"
                }`}
                onClick={() => setBatchMode((v) => !v)}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                    batchMode ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Batch Mode Group Select */}
        {batchMode && (
          <div className="bg-accent/5 border border-accent/20 rounded-[10px] p-4">
            <p className="text-xs font-display text-accent mb-2 font-medium">
              Batch Mode: New records will be added to all zones in the selected group
            </p>
            <select
              value={selectedGroupId}
              onChange={(e) => setSelectedGroupId(e.target.value)}
              className="px-3 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:border-accent/50 font-display"
            >
              <option value="">Select a group...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.zoneIds.length} zones)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Add Record Form */}
        {currentZoneId && (
          <AddRecordForm onSubmit={handleAddRecord} loading={addingRecord} />
        )}

        {/* DNS Records Table */}
        <div className="bg-bg-secondary border border-border rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-xs font-semibold font-display text-text-secondary uppercase tracking-wider">
              DNS Records
            </h3>
            {!loadingRecords && (
              <span className="text-[10px] font-mono text-text-muted">
                {records.length} record{records.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {loadingRecords ? (
            <div className="py-12 flex items-center justify-center">
              <LoadingSpinner size="sm" message="Loading records..." />
            </div>
          ) : error ? (
            <div className="p-6 space-y-3">
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm font-display text-red-300">{error}</p>
                <button
                  type="button"
                  onClick={() => void onRetry()}
                  className="mt-3 px-3 py-1.5 text-xs font-semibold rounded bg-red-500/20 text-red-100 hover:bg-red-500/30 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : !currentZoneId ? (
            <EmptyState
              icon="◈"
              title="No zone selected"
              description="Select a zone from the left panel to view its DNS records."
            />
          ) : (
            <DNSRecordsTable records={records} onDelete={setDeleteTarget} />
          )}
        </div>
      </div>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteRecord}
        title="Delete DNS Record"
        message={`Delete ${deleteTarget?.type} record "${deleteTarget?.name}" → ${deleteTarget?.content}?`}
        confirmLabel="Delete Record"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
