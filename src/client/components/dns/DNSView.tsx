import { useState, useEffect } from "react";
import type { Zone, Group, DNSRecord, DNSRecordType, CreateDNSInput } from "../../types";
import type { ToastType } from "../../types";
import { DNS_RECORD_TYPES } from "../../../shared/constants";
import { LoadingSpinner } from "../shared/LoadingSpinner";
import { EmptyState } from "../shared/EmptyState";
import { ConfirmDialog } from "../shared/ConfirmDialog";

// DNS type badge colors matching design spec
const TYPE_COLORS: Record<string, string> = {
  A: "#f97316",
  AAAA: "#eab308",
  CNAME: "#06b6d4",
  MX: "#8b5cf6",
  TXT: "#10b981",
  NS: "#6366f1",
  SRV: "#ec4899",
  CAA: "#14b8a6",
};

const TTL_OPTIONS = [
  { label: "Auto", value: 1 },
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
  { label: "5 min", value: 300 },
  { label: "15 min", value: 900 },
  { label: "30 min", value: 1800 },
  { label: "1 hour", value: 3600 },
  { label: "2 hours", value: 7200 },
  { label: "4 hours", value: 14400 },
  { label: "1 day", value: 86400 },
];

function TypeBadge({ type }: { type: string }) {
  const color = TYPE_COLORS[type] ?? "#888";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
      style={{
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}30`,
      }}
    >
      {type}
    </span>
  );
}

interface AddRecordFormProps {
  onSubmit: (input: CreateDNSInput) => Promise<void>;
  loading: boolean;
}

function AddRecordForm({ onSubmit, loading }: AddRecordFormProps) {
  const [form, setForm] = useState<CreateDNSInput>({
    type: "A",
    name: "@",
    content: "",
    ttl: 1,
    proxied: false,
  });

  const setField = <K extends keyof CreateDNSInput>(k: K, v: CreateDNSInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    await onSubmit({ ...form });
    setForm({ type: "A", name: "@", content: "", ttl: 1, proxied: false });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-bg-secondary border border-border rounded-[10px] p-4 space-y-3"
    >
      <h3 className="text-xs font-semibold font-display text-text-secondary uppercase tracking-wider">
        Add Record
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {/* Type */}
        <div>
          <label className="block text-xs font-display text-text-muted mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setField("type", e.target.value as DNSRecordType)}
            className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:border-accent/50 font-mono"
          >
            {DNS_RECORD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* TTL */}
        <div>
          <label className="block text-xs font-display text-text-muted mb-1">TTL</label>
          <select
            value={form.ttl}
            onChange={(e) => setField("ttl", Number(e.target.value))}
            className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:border-accent/50 font-mono"
          >
            {TTL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Name */}
        <div>
          <label className="block text-xs font-display text-text-muted mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="@ or subdomain"
            className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
          />
        </div>

        {/* Content */}
        <div>
          <label className="block text-xs font-display text-text-muted mb-1">Content</label>
          <input
            type="text"
            value={form.content}
            onChange={(e) => setField("content", e.target.value)}
            placeholder="IP or value"
            className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
          />
        </div>
      </div>

      {/* Proxied toggle (only for A/AAAA/CNAME) */}
      {["A", "AAAA", "CNAME"].includes(form.type) && (
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            className={`relative w-8 h-4 rounded-full transition-colors ${
              form.proxied ? "bg-accent" : "bg-border"
            }`}
            onClick={() => setField("proxied", !form.proxied)}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                form.proxied ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </div>
          <span className="text-xs font-display text-text-secondary">Proxied (Cloudflare)</span>
        </label>
      )}

      <button
        type="submit"
        disabled={loading || !form.name.trim() || !form.content.trim()}
        className="w-full py-2 text-xs font-semibold text-white rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? "Adding..." : "Add Record"}
      </button>
    </form>
  );
}

interface DNSTableProps {
  records: DNSRecord[];
  onDelete: (record: DNSRecord) => void;
}

function DNSTable({ records, onDelete }: DNSTableProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon="◈"
        title="No DNS records"
        description="This zone has no DNS records, or they couldn't be loaded."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              Type
            </th>
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              Name
            </th>
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              Content
            </th>
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              Proxy
            </th>
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              TTL
            </th>
            <th className="py-2.5 px-3" />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
              className="border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors"
            >
              <td className="py-2.5 px-3">
                <TypeBadge type={record.type} />
              </td>
              <td className="py-2.5 px-3">
                <span className="font-mono text-text-primary">{record.name}</span>
              </td>
              <td className="py-2.5 px-3 max-w-[240px]">
                <span
                  className="font-mono text-text-secondary truncate block"
                  title={record.content}
                >
                  {record.content}
                </span>
              </td>
              <td className="py-2.5 px-3">
                {record.proxied ? (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <span className="font-display text-accent text-[11px]">On</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-text-muted" />
                    <span className="font-display text-text-muted text-[11px]">Off</span>
                  </div>
                )}
              </td>
              <td className="py-2.5 px-3">
                <span className="font-mono text-text-muted">
                  {record.ttl === 1 ? "Auto" : record.ttl}
                </span>
              </td>
              <td className="py-2.5 px-3">
                <button
                  onClick={() => onDelete(record)}
                  className="text-text-muted hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10"
                  title="Delete record"
                >
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                    <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface DNSViewProps {
  zones: Zone[];
  groups: Group[];
  records: DNSRecord[];
  loadingRecords: boolean;
  addingRecord: boolean;
  currentZoneId: string | null;
  activeGroupId?: string;
  onSelectZone: (zoneId: string) => void;
  onCreateRecord: (zoneId: string, input: CreateDNSInput) => Promise<DNSRecord>;
  onDeleteRecord: (zoneId: string, recordId: string) => Promise<void>;
  onClearGroupFilter?: () => void;
  onToast: (message: string, type?: ToastType) => void;
}

export function DNSView({
  zones,
  groups,
  records,
  loadingRecords,
  currentZoneId,
  activeGroupId,
  onSelectZone,
  onCreateRecord,
  onDeleteRecord,
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

  // Auto-select first zone
  useEffect(() => {
    if (!currentZoneId && zones.length > 0) {
      onSelectZone(zones[0].id);
    }
  }, [zones, currentZoneId, onSelectZone]);

  async function handleAddRecord(input: CreateDNSInput) {
    if (!currentZoneId) return;
    setAddingRecord(true);
    try {
      await onCreateRecord(currentZoneId, input);
      onToast("DNS record added", "success");
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
              <div
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
              </div>
            </label>
          </div>
        </div>

        {/* Batch Mode Group Select */}
        {batchMode && (
          <div className="bg-accent/5 border border-accent/20 rounded-[10px] p-4">
            <p className="text-xs font-display text-accent mb-2 font-medium">
              Batch Mode: Changes will be applied to all zones in the selected group
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
          ) : !currentZoneId ? (
            <EmptyState
              icon="◈"
              title="No zone selected"
              description="Select a zone from the left panel to view its DNS records."
            />
          ) : (
            <DNSTable records={records} onDelete={setDeleteTarget} />
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
