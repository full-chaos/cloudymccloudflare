export type DeployMode = "append" | "replace";

interface DeployPanelProps {
  deployMode: DeployMode;
  deploying: boolean;
  ruleCount: number;
  targetSummary: string;
  onDeployModeChange: (mode: DeployMode) => void;
  onDeploy: () => void;
}

export function DeployPanel({
  deployMode,
  deploying,
  ruleCount,
  targetSummary,
  onDeployModeChange,
  onDeploy,
}: DeployPanelProps) {
  const disabled = deploying || ruleCount === 0;

  return (
    <div className="bg-bg-secondary border border-border rounded-[10px] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold font-display text-text-primary">
          Deploy
        </h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs font-display text-text-muted">Mode:</span>
            <select
              value={deployMode}
              onChange={(e) => onDeployModeChange(e.target.value as DeployMode)}
              className="text-xs bg-bg-tertiary border border-border rounded px-2 py-1 text-text-secondary focus:outline-none focus:border-accent/50 font-display"
            >
              <option value="append">Append</option>
              <option value="replace">Replace</option>
            </select>
          </label>
        </div>
      </div>

      <div className="text-xs font-display text-text-muted space-y-1">
        <div>
          Rules:{" "}
          <span className="text-text-secondary">{ruleCount} selected</span>
        </div>
        <div>
          Target: <span className="text-text-secondary">{targetSummary}</span>
        </div>
      </div>

      <button
        onClick={onDeploy}
        disabled={disabled}
        className="w-full py-2.5 text-sm font-semibold text-white rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {deploying ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            Deploying...
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083l6-15Zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471-.47 1.178Z" />
            </svg>
            Deploy Rules
          </>
        )}
      </button>
    </div>
  );
}
