import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCount } from "../../lib/format";
import { friendlyRuleName } from "../../lib/wafRuleNames";

const INITIAL_DIM = { width: 1, height: 1 };

export interface WAFRule {
  ruleId: string;
  source: string;
  action: string;
  events: number;
}

export interface WAFRuleBreakdownProps {
  rules: WAFRule[];
  height?: number;
  n?: number;
  emptyMessage?: string;
}

export function colorForAction(action: string): string {
  switch (action) {
    case "block":
      return "#f87171";
    case "managed_challenge":
    case "challenge":
    case "jschallenge":
    case "captcha":
      return "#fbbf24";
    case "log":
    case "allow":
      return "#888888";
    default:
      return "#a78bfa";
  }
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ") : s;
}

function RuleTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as WAFRule & { label: string };
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
      <div style={{ fontWeight: "bold", color: "#fff", marginBottom: 4 }}>{row.label}</div>
      <div style={{ color: "#888" }}>
        Action: <span style={{ color: "#e0e0e8" }}>{capitalize(row.action)}</span>
      </div>
      <div style={{ color: "#888" }}>
        Source: <span style={{ color: "#e0e0e8" }}>{row.source}</span>
      </div>
      <div style={{ color: "#888" }}>
        Events: <span style={{ color: "#e0e0e8" }}>{formatCount(row.events)}</span>
      </div>
    </div>
  );
}

export function WAFRuleBreakdown({
  rules,
  height = 256,
  n = 10,
  emptyMessage = "No firewall events in this window.",
}: WAFRuleBreakdownProps) {
  const data = useMemo(() => {
    const filtered = rules.filter((r) => r.events > 0);
    const sorted = [...filtered].sort((a, b) => b.events - a.events).slice(0, n);
    return sorted.map((r) => ({ ...r, label: friendlyRuleName(r.ruleId) }));
  }, [rules, n]);

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
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIM}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <CartesianGrid stroke="#1f1f2e" strokeDasharray="2 2" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
            tickFormatter={(v: number) => formatCount(v)}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={140}
            tick={{ fontSize: 10, fill: "#888" }}
            tickLine={false}
            axisLine={{ stroke: "#1f1f2e" }}
          />
          <Tooltip cursor={{ fill: "#1f1f2e", opacity: 0.4 }} content={<RuleTooltip />} />
          <Bar dataKey="events" isAnimationActive={false}>
            {data.map((entry) => (
              <Cell key={`${entry.ruleId}-${entry.action}`} fill={colorForAction(entry.action)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
