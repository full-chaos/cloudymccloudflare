import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const INITIAL_DIM = { width: 1, height: 1 };

export interface TopNBarChartProps {
  data: { id: string; label: string; value: number }[];
  accent: string;
  formatValue: (v: number) => string;
  n?: number;
  onItemClick?: (id: string) => void;
  emptyMessage?: string;
  height?: number;
  ariaLabel?: string;
}

export function TopNBarChart({
  data,
  accent,
  formatValue,
  n = 10,
  onItemClick,
  emptyMessage = "No data in this window.",
  height = 256,
  ariaLabel,
}: TopNBarChartProps) {
  const sortedData = useMemo(() => {
    return [...data]
      .sort((a, b) => b.value - a.value)
      .slice(0, n);
  }, [data, n]);

  if (sortedData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-xs"
        style={{ height }}
        aria-label={ariaLabel}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height }} aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIM}>
        <BarChart
          data={sortedData}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="#1f1f2e" strokeDasharray="2 2" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
            tickFormatter={(v: number) => formatValue(v)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={120}
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
          />
          <Tooltip
            cursor={{ fill: "#1f1f2e", opacity: 0.4 }}
            contentStyle={{
              backgroundColor: "#111118",
              border: "1px solid #1f1f2e",
              borderRadius: 8,
              fontSize: 12,
              fontFamily: "JetBrains Mono, monospace",
            }}
            labelStyle={{ color: "#888", marginBottom: 4 }}
            itemStyle={{ color: "#e0e0e8" }}
            formatter={(v) => [formatValue(Number(v) || 0), ""]}
          />
          <Bar
            dataKey="value"
            fill={accent}
            isAnimationActive={false}
            onClick={(payload) => {
              if (!onItemClick || !payload) return;
              const dataEntry = payload as unknown as Record<string, unknown>;
              const id = dataEntry.id ?? (dataEntry.payload as Record<string, unknown>)?.id;
              if (typeof id === "string") {
                onItemClick(id);
              }
            }}
            style={{ cursor: onItemClick ? "pointer" : "default" }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
