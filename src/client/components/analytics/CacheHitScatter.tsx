import { useMemo } from "react";
import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBytes, formatPercent } from "../../lib/format";

interface CacheHitScatterProps {
  zones: {
    id: string;
    name: string;
    bytes: number;
    cacheHitRatio: number;
  }[];
  onZoneClick?: (zoneId: string) => void;
  height?: number;
  emptyMessage?: string;
}

function getDotColor(bytes: number, ratioPct: number, maxBytes: number): string {
  const trafficShare = maxBytes > 0 ? bytes / maxBytes : 0;
  if (trafficShare < 0.05) return "#888";       // low-signal grey
  if (ratioPct >= 70) return "#34d399";         // healthy green
  if (ratioPct >= 30) return "#fbbf24";         // amber warning
  return "#f87171";                             // unhealthy red
}

export function CacheHitScatter({
  zones,
  onZoneClick,
  height = 256,
  emptyMessage = "No data in this window.",
}: CacheHitScatterProps) {
  const data = useMemo(() => {
    return zones
      .filter((z) => !(z.bytes === 0 && z.cacheHitRatio === 0))
      .map((z) => ({
        id: z.id,
        name: z.name,
        bytes: z.bytes,
        ratioPct: z.cacheHitRatio * 100,
      }));
  }, [zones]);

  const maxBytes = useMemo(() => {
    return data.reduce((max, d) => Math.max(max, d.bytes), 0);
  }, [data]);

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-text-muted text-xs"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ height, width: "100%" }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#1f1f2e" strokeDasharray="2 2" />
          <XAxis
            type="number"
            dataKey="bytes"
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
            tickFormatter={formatBytes}
          />
          <YAxis
            type="number"
            dataKey="ratioPct"
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
            tickFormatter={(v: number) => `${v}%`}
            width={50}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
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
                    <div style={{ fontWeight: "bold", marginBottom: 4 }}>{data.name}</div>
                    <div>Bandwidth: {formatBytes(data.bytes)}</div>
                    <div>Hit ratio: {formatPercent(data.ratioPct / 100, 1)}</div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter
            data={data}
            isAnimationActive={false}
            onClick={(e: any) => {
              if (onZoneClick && e && e.payload && e.payload.id) {
                onZoneClick(e.payload.id);
              }
            }}
            style={{ cursor: onZoneClick ? "pointer" : "default" }}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={getDotColor(entry.bytes, entry.ratioPct, maxBytes)}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
