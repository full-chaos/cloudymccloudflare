import { useMemo } from "react";
import { ResponsiveContainer, Treemap, Tooltip } from "recharts";
import { formatCount } from "../../lib/format";
import { colorForZone } from "../../lib/colors";

const INITIAL_DIM = { width: 1, height: 1 };

interface TrafficTreemapProps {
  zones: {
    id: string;
    name: string;
    requests: number;
    groupNames?: string[];
    groupColors?: string[];
    clusterName?: string | null;
  }[];
  onZoneClick?: (zoneId: string) => void;
  height?: number;
  emptyMessage?: string;
}

function TreemapContent(props: any) {
  const { x, y, width, height, name, fill } = props;

  const showText = width >= 60 && height >= 24;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        stroke="#1f1f2e"
        strokeWidth={1}
        style={{ cursor: "pointer" }}
      />
      {showText && (
        <text
          x={x + width / 2}
          y={y + height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#0f0f17"
          fontSize={12}
          fontFamily="JetBrains Mono, monospace"
          style={{ pointerEvents: "none" }}
        >
          {name.length > Math.floor(width / 8) ? name.slice(0, Math.floor(width / 8) - 1) + "…" : name}
        </text>
      )}
    </g>
  );
}

function TreemapTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const groupNames = data.groupNames && data.groupNames.length > 0 
      ? data.groupNames.join(", ") 
      : "Ungrouped";
    const clusterName = data.clusterName || "—";

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
        <div style={{ fontWeight: "bold", color: "#fff", marginBottom: 4 }}>{data.name}</div>
        <div>Group(s): {groupNames}</div>
        <div>Cluster: {clusterName}</div>
        <div style={{ marginTop: 4, color: "#888" }}>
          Requests: <span style={{ color: "#e0e0e8" }}>{formatCount(data.requests)}</span>
        </div>
      </div>
    );
  }
  return null;
}

export function TrafficTreemap({
  zones,
  onZoneClick,
  height = 320,
  emptyMessage = "No data in this window.",
}: TrafficTreemapProps) {
  const data = useMemo(() => {
    return zones.map((zone) => ({
      ...zone,
      fill: colorForZone({
        groupColors: zone.groupColors || [],
        clusterName: zone.clusterName || null,
      }),
    }));
  }, [zones]);

  const totalRequests = useMemo(() => {
    return data.reduce((sum, z) => sum + z.requests, 0);
  }, [data]);

  if (data.length === 0 || totalRequests === 0) {
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
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIM}>
        <Treemap
          data={data}
          dataKey="requests"
          nameKey="name"
          isAnimationActive={false}
          content={<TreemapContent />}
          onClick={(e: any) => {
            if (e && e.id && onZoneClick) {
              onZoneClick(e.id);
            }
          }}
        >
          <Tooltip content={<TreemapTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
