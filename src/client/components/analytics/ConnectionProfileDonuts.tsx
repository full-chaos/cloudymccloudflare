import { useMemo } from "react";
import { Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatCount, formatPercent } from "../../lib/format";

export interface ConnectionProfileDonutsProps {
  httpVersions: Array<{ key: string; requests: number }>;
  sslVersions: Array<{ key: string; requests: number }>;
  height?: number;
  emptyMessage?: string;
}

const INITIAL_DIM = { width: 1, height: 1 };

const HTTP_COLORS = ["#7dd3fc", "#fde68a", "#c4b5fd", "#fda4af", "#86efac"];
const SSL_COLORS = ["#67e8f9", "#d8b4fe", "#fdba74", "#a3e635"];

export function pickTopVersion(items: Array<{ key: string; requests: number }>): string {
  if (!items || items.length === 0) return "—";
  let max = 0;
  let topKey = "—";
  for (const item of items) {
    if (item.requests > max) {
      max = item.requests;
      topKey = item.key;
    }
  }
  return max > 0 ? topKey : "—";
}

function DonutTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const total = data.total || 1;
    const percent = formatPercent(data.requests / total);
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
        <div style={{ fontWeight: "bold", color: "#fff", marginBottom: 4 }}>{data.key}</div>
        <div style={{ color: "#888" }}>
          Requests: <span style={{ color: "#e0e0e8" }}>{formatCount(data.requests)}</span> ({percent})
        </div>
      </div>
    );
  }
  return null;
}

export function ConnectionProfileDonuts({
  httpVersions,
  sslVersions,
  height = 256,
  emptyMessage = "No connection profile data in this window.",
}: ConnectionProfileDonutsProps) {
  const httpTotal = useMemo(() => httpVersions.reduce((sum, item) => sum + item.requests, 0), [httpVersions]);
  const sslTotal = useMemo(() => sslVersions.reduce((sum, item) => sum + item.requests, 0), [sslVersions]);

  if (httpTotal === 0 && sslTotal === 0) {
    return (
      <div className="flex items-center justify-center text-text-muted text-xs" style={{ height }}>
        {emptyMessage}
      </div>
    );
  }

  const httpData = httpVersions.map((item, i) => ({
    ...item,
    total: httpTotal,
    fill: HTTP_COLORS[i % HTTP_COLORS.length],
  }));

  const sslData = sslVersions.map((item, i) => ({
    ...item,
    total: sslTotal,
    fill: SSL_COLORS[i % SSL_COLORS.length],
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="flex flex-col">
        <h3 className="text-secondary text-xs uppercase tracking-wide font-display mb-2 text-center">
          HTTP version
        </h3>
        {httpTotal > 0 ? (
          <div className="relative w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIM}>
              <PieChart>
                <Pie
                  data={httpData}
                  dataKey="requests"
                  nameKey="key"
                  innerRadius="55%"
                  outerRadius="80%"
                  isAnimationActive={false}
                />
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-text-muted">
              Most: {pickTopVersion(httpVersions)}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-text-muted text-xs w-full" style={{ height }}>
            No HTTP data
          </div>
        )}
      </div>

      <div className="flex flex-col">
        <h3 className="text-secondary text-xs uppercase tracking-wide font-display mb-2 text-center">
          TLS version
        </h3>
        {sslTotal > 0 ? (
          <div className="relative w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIM}>
              <PieChart>
                <Pie
                  data={sslData}
                  dataKey="requests"
                  nameKey="key"
                  innerRadius="55%"
                  outerRadius="80%"
                  isAnimationActive={false}
                />
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-text-muted">
              Most: {pickTopVersion(sslVersions)}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center text-text-muted text-xs w-full" style={{ height }}>
            No TLS data
          </div>
        )}
      </div>
    </div>
  );
}
