import { useId, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import type { ZoneTimeSeriesPoint } from "../../../shared/types";

const INITIAL_DIM = { width: 1, height: 1 };

type Metric = "requests" | "bytes" | "cachedBytes" | "threats";

interface MetricSparklineProps {
  series: ZoneTimeSeriesPoint[];
  metric: Metric;
  color?: string;
  height?: number;
  width?: number | string;
  ariaLabel?: string;
}

const METRIC_COLOR: Record<Metric, string> = {
  requests: "#f97316",
  bytes: "#60a5fa",
  cachedBytes: "#34d399",
  threats: "#f87171",
};

export function MetricSparkline({
  series,
  metric,
  color,
  height = 32,
  width = "100%",
  ariaLabel,
}: MetricSparklineProps) {
  const gid = useId();
  const c = color ?? METRIC_COLOR[metric];

  const data = useMemo(() => {
    let allNull = true;
    const mapped = series.map((p) => {
      const val = p[metric];
      if (val !== null) allNull = false;
      return { value: val };
    });
    return allNull ? null : mapped;
  }, [series, metric]);

  if (!data) return null;

  return (
    <div style={{ width, height, pointerEvents: "none" }} aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIM}>
        <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`spark-${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c} stopOpacity={0.4} />
              <stop offset="100%" stopColor={c} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={c}
            strokeWidth={1.5}
            fill={`url(#spark-${gid})`}
            isAnimationActive={false}
            connectNulls={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
