import { useMemo, useState } from "react";
import type { ZoneMetrics } from "../../types";
import { formatBytes, formatCount, formatPercent } from "../../lib/format";

type SortKey = "zoneName" | "requests" | "bytes" | "cachedBytes" | "threats" | "cacheHitRatio";
type SortDir = "asc" | "desc";

interface SortableZoneTableProps {
  rows: ZoneMetrics[];
  onRowClick?: (zoneId: string) => void;
}

function cacheHitRatio(row: ZoneMetrics): number {
  if (row.bytes <= 0) return Number.NaN;
  const r = row.cachedBytes / row.bytes;
  return r < 0 ? 0 : r > 1 ? 1 : r;
}

export function SortableZoneTable({ rows, onRowClick }: SortableZoneTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("requests");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const av = accessor(a, sortKey);
      const bv = accessor(b, sortKey);
      if (av === bv) return 0;
      // NaN always sinks to bottom regardless of direction.
      if (Number.isNaN(av)) return 1;
      if (Number.isNaN(bv)) return -1;
      const cmp = av < bv ? -1 : 1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, sortKey, sortDir]);

  function onSort(k: SortKey) {
    if (k === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(k);
      setSortDir(k === "zoneName" ? "asc" : "desc");
    }
  }

  return (
    <div className="border border-border rounded-[10px] overflow-hidden bg-bg-secondary">
      <table className="w-full text-sm">
        <thead className="bg-bg-tertiary border-b border-border">
          <tr className="text-left text-text-secondary text-xs font-display">
            <SortHeader label="Zone" k="zoneName" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortHeader label="Requests" k="requests" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortHeader label="Bandwidth" k="bytes" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortHeader label="Cached" k="cachedBytes" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortHeader label="Hit ratio" k="cacheHitRatio" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
            <SortHeader label="Threats" k="threats" sortKey={sortKey} sortDir={sortDir} onSort={onSort} right />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center text-text-muted py-8 text-xs">
                No zones to display.
              </td>
            </tr>
          ) : (
            sorted.map((row) => (
              <tr
                key={row.zoneId}
                onClick={() => onRowClick?.(row.zoneId)}
                className={`border-b border-border last:border-b-0 transition-colors ${
                  onRowClick ? "cursor-pointer hover:bg-bg-tertiary" : ""
                }`}
              >
                <td className="px-4 py-2.5 font-mono text-text-primary">
                  {row.zoneName || row.zoneId.slice(0, 8)}
                </td>
                <td className="px-4 py-2.5 font-mono text-text-primary text-right">
                  {formatCount(row.requests)}
                </td>
                <td className="px-4 py-2.5 font-mono text-text-primary text-right">
                  {formatBytes(row.bytes)}
                </td>
                <td className="px-4 py-2.5 font-mono text-text-secondary text-right">
                  {formatBytes(row.cachedBytes)}
                </td>
                <td className="px-4 py-2.5 font-mono text-right">
                  <CacheHitCell ratio={cacheHitRatio(row)} />
                </td>
                <td className="px-4 py-2.5 font-mono text-right">
                  {row.threats > 0 ? (
                    <span className="text-red-400">{formatCount(row.threats)}</span>
                  ) : (
                    <span className="text-text-muted">0</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function accessor(r: ZoneMetrics, k: SortKey): number | string {
  switch (k) {
    case "zoneName":
      return (r.zoneName || r.zoneId).toLowerCase();
    case "cacheHitRatio":
      return cacheHitRatio(r);
    default:
      return r[k];
  }
}

function CacheHitCell({ ratio }: { ratio: number }) {
  if (Number.isNaN(ratio)) return <span className="text-text-muted">—</span>;
  const color = ratio >= 0.6 ? "text-emerald-400" : ratio >= 0.3 ? "text-yellow-400" : "text-text-secondary";
  return <span className={color}>{formatPercent(ratio, 0)}</span>;
}

interface SortHeaderProps {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  right?: boolean;
}

function SortHeader({ label, k, sortKey, sortDir, onSort, right }: SortHeaderProps) {
  const active = sortKey === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={`px-4 py-2 font-medium cursor-pointer select-none hover:text-text-primary transition-colors ${
        right ? "text-right" : "text-left"
      }`}
    >
      <span className={active ? "text-accent" : ""}>{label}</span>
      {active && <span className="text-accent ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
