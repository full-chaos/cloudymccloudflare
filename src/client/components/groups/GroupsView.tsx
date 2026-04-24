import { useState } from "react";
import type { Group, Zone } from "../../types";
import type { ToastType } from "../../types";
import { GROUP_COLORS } from "../../../shared/constants";
import { EmptyState } from "../shared/EmptyState";
import { ConfirmDialog } from "../shared/ConfirmDialog";
import { LoadingOverlay } from "../shared/LoadingSpinner";

interface GroupsViewProps {
  groups: Group[];
  zones: Zone[];
  loading: boolean;
  error?: string | null;
  onCreateGroup: (name: string, color: string) => Promise<Group>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onAddZone: (groupId: string, zoneId: string, zoneName: string) => Promise<void>;
  onRemoveZone: (groupId: string, zoneId: string) => Promise<void>;
  onToast: (message: string, type?: ToastType) => void;
}

const PRESET_COLORS = GROUP_COLORS as readonly string[];

interface CreateGroupFormState {
  name: string;
  color: string;
}

export function GroupsView({
  groups,
  zones,
  loading,
  error,
  onCreateGroup,
  onDeleteGroup,
  onAddZone,
  onRemoveZone,
  onToast,
}: GroupsViewProps) {
  const [form, setForm] = useState<CreateGroupFormState>({
    name: "",
    color: PRESET_COLORS[0],
  });
  const [creating, setCreating] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setCreating(true);
    try {
      const created = await onCreateGroup(form.name.trim(), form.color);
      setForm({ name: "", color: PRESET_COLORS[0] });
      setSelectedGroupId(created.id);
      onToast(`Group "${created.name}" created`, "success");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to create group", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await onDeleteGroup(deleteTarget.id);
      if (selectedGroupId === deleteTarget.id) setSelectedGroupId(null);
      onToast(`Group "${deleteTarget.name}" deleted`, "success");
      setDeleteTarget(null);
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to delete group", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleZone(zoneId: string) {
    if (!selectedGroup) return;
    const inGroup = selectedGroup.zoneIds.includes(zoneId);
    try {
      if (inGroup) {
        await onRemoveZone(selectedGroup.id, zoneId);
      } else {
        // Server expects the zone name alongside the id (denormalized in group_zones).
        const zone = zones.find((z) => z.id === zoneId);
        if (!zone) throw new Error(`Zone ${zoneId} not found`);
        await onAddZone(selectedGroup.id, zoneId, zone.name);
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Failed to update group", "error");
    }
  }

  if (loading) return <LoadingOverlay message="Loading groups..." />;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-start gap-6">
        {/* Left: create form + group grid */}
        <div className="flex-1 min-w-0 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-display text-red-200">{error}</p>
            </div>
          )}
          {/* Create Group Form */}
          <div className="bg-bg-secondary border border-border rounded-[10px] p-5">
            <h2 className="text-sm font-semibold font-display text-text-primary mb-4">
              Create Group
            </h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-display text-text-secondary mb-1.5">
                  Group Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Photography Sites"
                  className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 transition-colors font-display"
                  maxLength={60}
                />
              </div>

              <div>
                <label className="block text-xs font-display text-text-secondary mb-1.5">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, color }))}
                      className={`w-7 h-7 rounded-full transition-all ${
                        form.color === color
                          ? "ring-2 ring-offset-2 ring-offset-bg-secondary ring-white scale-110"
                          : "hover:scale-105 opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || !form.name.trim()}
                className="px-5 py-2 text-sm font-semibold text-white rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {creating ? "Creating..." : "Create Group"}
              </button>
            </form>
          </div>

          {/* Groups Grid */}
          {groups.length === 0 ? (
            <EmptyState
              icon="⬡"
              title="No groups yet"
              description="Create your first group to organize your domains and apply bulk operations."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {groups.map((group) => {
                const isSelected = selectedGroupId === group.id;
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={group.id}
                    className={`
                      w-full text-left bg-bg-secondary border rounded-[10px] p-4 cursor-pointer
                      transition-all duration-150
                      ${
                        isSelected
                          ? "border-accent/50 bg-accent/5"
                          : "border-border hover:border-border-hover"
                      }
                    `}
                    onClick={() =>
                      setSelectedGroupId(isSelected ? null : group.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedGroupId(isSelected ? null : group.id);
                      }
                    }}
                    aria-pressed={isSelected}
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: group.color }}
                        />
                        <span className="text-sm font-semibold font-display text-text-primary truncate">
                          {group.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(group);
                        }}
                        className="text-text-muted hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10 flex-shrink-0"
                        title="Delete group"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                          <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-display text-text-muted">
                        {group.zoneIds.length} domain{group.zoneIds.length !== 1 ? "s" : ""}
                      </span>
                      {isSelected && (
                        <span className="text-accent font-display">Selected</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Zone assignment panel */}
        {selectedGroup && (
          <div className="w-80 flex-shrink-0">
            <div className="bg-bg-secondary border border-border rounded-[10px] p-4 sticky top-6">
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedGroup.color }}
                />
                <h3 className="text-sm font-semibold font-display text-text-primary">
                  {selectedGroup.name}
                </h3>
              </div>
              <p className="text-xs font-display text-text-muted mb-3">
                Click a domain to add/remove it from this group.
              </p>

              <div className="space-y-0.5 max-h-[500px] overflow-y-auto">
                {zones.map((zone) => {
                  const inGroup = selectedGroup.zoneIds.includes(zone.id);
                  return (
                    <button
                      key={zone.id}
                      onClick={() => handleToggleZone(zone.id)}
                      className={`
                        w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-xs
                        transition-all
                        ${
                          inGroup
                            ? "bg-accent/10 border border-accent/30 text-accent"
                            : "bg-bg-tertiary border border-border hover:border-border-hover text-text-secondary hover:text-text-primary"
                        }
                      `}
                    >
                      <span
                        className={`w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0 transition-colors ${
                          inGroup
                            ? "bg-accent border-accent"
                            : "border-border"
                        }`}
                      >
                        {inGroup && (
                          <svg width="8" height="8" viewBox="0 0 16 16" fill="white">
                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                          </svg>
                        )}
                      </span>
                      <span className="font-mono truncate">{zone.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 pt-3 border-t border-border text-xs font-display text-text-muted text-center">
                {selectedGroup.zoneIds.length} of {zones.length} selected
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirm Dialog */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Group"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will not delete any domains, only the group.`}
        confirmLabel="Delete Group"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
