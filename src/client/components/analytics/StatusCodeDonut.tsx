import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCount, formatPercent } from "../../lib/format";

const INITIAL_DIM = { width: 1, height: 1 };

export type StatusBand = "2xx" | "3xx" | "4xx" | "5xx" | "other";

const BAND_COLORS: Record<StatusBand, string> = {
  "2xx": "#34d399",
  "3xx": "#60a5fa",
  "4xx": "#fbbf24",
  "5xx": "#f87171",
  other: "#888888",
};

const BAND_ORDER: StatusBand[] = ["2xx", "3xx", "4xx", "5xx", "other"];

export interface StatusCodeDonutProps {
  items: Array<{ key: string; requests: number }>;
  height?: number;
  emptyMessage?: string;
}

export interface BandRow {
  band: StatusBand;
  value: number;
  codes: Array<{ code: string; requests: number }>;
}

export function groupIntoBands(
  items: Array<{ key: string; requests: number }>,
): BandRow[] {
  const buckets: Record<StatusBand, BandRow> = {
    "2xx": { band: "2xx", value: 0, codes: [] },
    "3xx": { band: "3xx", value: 0, codes: [] },
    "4xx": { band: "4xx", value: 0, codes: [] },
    "5xx": { band: "5xx", value: 0, codes: [] },
    other: { band: "other", value: 0, codes: [] },
  };

  for (const item of items) {
    if (item.requests <= 0) continue;
    const n = Number(item.key);
    let band: StatusBand;
    if (!Number.isFinite(n) || n < 100 || n >= 600) band = "other";
    else if (n < 300) band = "2xx";
    else if (n < 400) band = "3xx";
    else if (n < 500) band = "4xx";
    else band = "5xx";

    buckets[band].value += item.requests;
    buckets[band].codes.push({ code: item.key, requests: item.requests });
  }

  return BAND_ORDER.map((b) => buckets[b]).filter((row) => row.value > 0);
}

function BandTooltip({ active, payload, total }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as BandRow & { total: number };
  const pct = formatPercent(row.value / (total || 1));
  const codes = [...row.codes].sort((a, b) => b.requests - a.requests).slice(0, 5);
  return (
    <div
      style={{
        backgroundColor: "#111118",
        border: "1px solid #1f1f2e",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        fontFamily: "JetBrains Mono, monospace",
        color: "#e0e0e8",
      }}
    >
      <div style={{ fontWeight: "bold", color: "#fff", marginBottom: 4 }}>
        {row.band}: {formatCount(row.value)} ({pct})
      </div>
      {codes.map((c) => (
        <div key={c.code} style={{ color: "#888" }}>
          {c.code}: <span style={{ color: "#e0e0e8" }}>{formatCount(c.requests)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusCodeDonut({
  items,
  height = 256,
  emptyMessage = "No status code data in this window.",
}: StatusCodeDonutProps) {
  const bands = useMemo(() => groupIntoBands(items), [items]);
  const total = useMemo(() => bands.reduce((s, b) => s + b.value, 0), [bands]);
  const codeCount = useMemo(
    () => bands.reduce((s, b) => s + b.codes.length, 0),
    [bands],
  );

  if (total === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-xs"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  const data = bands.map((b) => ({ ...b, total }));

  return (
    <div className="relative w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIM}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="band"
            innerRadius="55%"
            outerRadius="80%"
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.band} fill={BAND_COLORS[entry.band]} />
            ))}
          </Pie>
          <Tooltip content={<BandTooltip total={total} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="font-mono text-text-primary text-lg">{formatCount(total)}</div>
        <div className="text-text-muted text-xs">across {codeCount} status code{codeCount === 1 ? "" : "s"}</div>
      </div>
    </div>
  );
}
