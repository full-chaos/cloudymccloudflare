import type { Zone, Group } from "../../types";

export type TargetMode = "zones" | "group";

interface TargetSelectorProps {
  zones: Zone[];
  groups: Group[];
  targetMode: TargetMode;
  selectedZoneIds: string[];
  selectedGroupId: string;
  onTargetModeChange: (mode: TargetMode) => void;
  onToggleZone: (zoneId: string) => void;
  onSelectAllZones: () => void;
  onClearZoneSelection: () => void;
  onSelectedGroupIdChange: (groupId: string) => void;
}

export function TargetSelector({
  zones,
  groups,
  targetMode,
  selectedZoneIds,
  selectedGroupId,
  onTargetModeChange,
  onToggleZone,
  onSelectAllZones,
  onClearZoneSelection,
  onSelectedGroupIdChange,
}: TargetSelectorProps) {
  return (
    <div className="bg-bg-secondary border border-border rounded-[10px] p-5 space-y-4">
      <h2 className="text-sm font-semibold font-display text-text-primary">
        Target Selection
      </h2>

      <div className="flex items-center gap-1 bg-bg-tertiary border border-border rounded-lg p-1 w-fit">
        {(["zones", "group"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => onTargetModeChange(mode)}
            className={`px-4 py-1.5 text-xs font-display font-medium rounded-md capitalize transition-all ${
              targetMode === mode
                ? "bg-accent text-white shadow"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {mode === "zones" ? "Individual Zones" : "Group"}
          </button>
        ))}
      </div>

      {targetMode === "zones" ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-display text-text-secondary">
              {selectedZoneIds.length} of {zones.length} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={onSelectAllZones}
                className="text-xs font-display text-accent hover:text-accent/80 transition-colors"
              >
                All
              </button>
              <span className="text-text-muted">·</span>
              <button
                onClick={onClearZoneSelection}
                className="text-xs font-display text-text-muted hover:text-text-secondary transition-colors"
              >
                None
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto">
            {zones.map((zone) => {
              const sel = selectedZoneIds.includes(zone.id);
              return (
                <button
                  key={zone.id}
                  onClick={() => onToggleZone(zone.id)}
                  className={`text-xs font-mono px-2.5 py-1 rounded-lg border transition-all ${
                    sel
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-border bg-bg-tertiary text-text-secondary hover:border-border-hover hover:text-text-primary"
                  }`}
                >
                  {zone.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-display text-text-secondary mb-1.5">
            Select Group
          </label>
          <select
            value={selectedGroupId}
            onChange={(e) => onSelectedGroupIdChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-bg-primary border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent/50 font-display"
          >
            <option value="">Choose a group...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.zoneIds.length} zones)
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
