import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ZoneTimeSeriesPoint } from "../../../shared/types";
import { formatBytes, formatCount, formatHourFull, formatHourLabel } from "../../lib/format";

const INITIAL_DIM = { width: 1, height: 1 };

type Metric = "requests" | "bytes" | "cachedBytes" | "threats";

interface StackedAreaChartProps {
  seriesByKey: Record<string, ZoneTimeSeriesPoint[]>;
  keyLabels?: Record<string, string>;
  metric: Metric;
  colors?: Record<string, string>;
  height?: number;
  emptyMessage?: string;
}

const METRIC_META: Record<Metric, { label: string; color: string; format: (v: number) => string }> = {
  requests: { label: "Requests", color: "#f97316", format: formatCount },
  bytes: { label: "Bandwidth", color: "#60a5fa", format: formatBytes },
  cachedBytes: { label: "Cached", color: "#34d399", format: formatBytes },
  threats: { label: "Threats", color: "#f87171", format: formatCount },
};

const DEFAULT_PALETTE = [
  "#7dd3fc",
  "#fde68a",
  "#c4b5fd",
  "#fda4af",
  "#86efac",
  "#fdba74",
  "#67e8f9",
  "#d8b4fe",
];

export function StackedAreaChart({
  seriesByKey,
  keyLabels = {},
  metric,
  colors = {},
  height = 256,
  emptyMessage,
}: StackedAreaChartProps) {
  const meta = METRIC_META[metric];

  const { data, keys, keyColors } = useMemo(() => {
    const allKeys = Object.keys(seriesByKey);
    if (allKeys.length === 0) {
      return { data: [], keys: [], keyColors: {} };
    }

    const totals = allKeys.map((key) => {
      const series = seriesByKey[key];
      const total = series.reduce((sum, p) => sum + (p[metric] || 0), 0);
      return { key, total };
    });
    totals.sort((a, b) => b.total - a.total);
    const sortedKeys = totals.map((t) => t.key);

    const assignedColors: Record<string, string> = {};
    sortedKeys.forEach((key, i) => {
      assignedColors[key] = colors[key] || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];
    });

    const timestampMap = new Map<string, Record<string, number | null | string>>();
    
    for (const key of sortedKeys) {
      const series = seriesByKey[key];
      for (const p of series) {
        if (!timestampMap.has(p.timestamp)) {
          timestampMap.set(p.timestamp, { timestamp: p.timestamp });
        }
        const entry = timestampMap.get(p.timestamp)!;
        entry[key] = p[metric];
      }
    }

    const mergedData = Array.from(timestampMap.values()).sort((a, b) => {
      return (a.timestamp as string).localeCompare(b.timestamp as string);
    });

    return { data: mergedData, keys: sortedKeys, keyColors: assignedColors };
  }, [seriesByKey, metric, colors]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center text-text-muted text-xs" style={{ height }}>
        {emptyMessage ?? "No data in this window."}
      </div>
    );
  }

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIM}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            {keys.map((key) => (
              <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={keyColors[key]} stopOpacity={0.35} />
                <stop offset="100%" stopColor={keyColors[key]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke="#1f1f2e" strokeDasharray="2 2" vertical={false} />
          <XAxis
            dataKey="timestamp"
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
            minTickGap={20}
            tickFormatter={formatHourLabel}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
            tickFormatter={(v: number) => meta.format(v)}
            width={50}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const p = payload[0].payload as { timestamp?: string } & Record<string, number | null>;
                let total = 0;
                const items = keys.map((key) => {
                  const val = p[key];
                  if (val != null) total += val;
                  return {
                    key,
                    name: keyLabels[key] ?? key,
                    value: val,
                    color: keyColors[key],
                  };
                });

                return (
                  <div
                    style={{
                      backgroundColor: "#111118",
                      border: "1px solid #1f1f2e",
                      borderRadius: 8,
                      padding: 10,
                      fontSize: 12,
                      fontFamily: "JetBrains Mono, monospace",
                    }}
                  >
                    <div style={{ color: "#888", marginBottom: 4 }}>
                      {p.timestamp ? formatHourFull(p.timestamp) : label}
                    </div>
                    {items.map((item) => (
                      <div key={item.key} style={{ display: "flex", justifyContent: "space-between", gap: 16, color: item.color }}>
                        <span>{item.name}</span>
                        <span>{item.value != null ? meta.format(item.value) : "—"}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#e0e0e8", marginTop: 4, paddingTop: 4, borderTop: "1px solid #1f1f2e", fontWeight: "bold" }}>
                      <span>Total</span>
                      <span>{meta.format(total)}</span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          {keys.map((key) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stackId="1"
              stroke={keyColors[key]}
              strokeWidth={2}
              fill={`url(#grad-${key})`}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
