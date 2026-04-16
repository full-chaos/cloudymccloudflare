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
import type { ZoneTimeSeriesPoint } from "../../types";
import { formatBytes, formatCount, formatHourFull, formatHourLabel } from "../../lib/format";

type Metric = "requests" | "bytes" | "cachedBytes" | "threats";

interface RequestsChartProps {
  series: ZoneTimeSeriesPoint[];
  metric: Metric;
}

const METRIC_META: Record<Metric, { label: string; color: string; format: (v: number) => string }> = {
  requests: { label: "Requests", color: "#f97316", format: formatCount },
  bytes: { label: "Bandwidth", color: "#60a5fa", format: formatBytes },
  cachedBytes: { label: "Cached", color: "#34d399", format: formatBytes },
  threats: { label: "Threats", color: "#f87171", format: formatCount },
};

export function RequestsChart({ series, metric }: RequestsChartProps) {
  const meta = METRIC_META[metric];

  const data = useMemo(
    () =>
      series.map((p) => ({
        timestamp: p.timestamp,
        label: formatHourLabel(p.timestamp),
        value: p[metric],
      })),
    [series, metric],
  );

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-text-muted text-xs">
        No data in this window.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={meta.color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#1f1f2e" strokeDasharray="2 2" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
            tickFormatter={(v: number) => meta.format(v)}
            width={50}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#111118",
              border: "1px solid #1f1f2e",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "JetBrains Mono, monospace",
            }}
            labelStyle={{ color: "#888", marginBottom: 4 }}
            itemStyle={{ color: "#e0e0e8" }}
            labelFormatter={(_label, payload) => {
              const p = payload?.[0]?.payload as { timestamp?: string } | undefined;
              return p?.timestamp ? formatHourFull(p.timestamp) : "";
            }}
            formatter={(v) => [meta.format(Number(v) || 0), meta.label] as [string, string]}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={meta.color}
            strokeWidth={2}
            fill={`url(#grad-${metric})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
