const TYPE_COLORS: Record<string, string> = {
  A: "#f97316",
  AAAA: "#eab308",
  CNAME: "#06b6d4",
  MX: "#8b5cf6",
  TXT: "#10b981",
  NS: "#6366f1",
  SRV: "#ec4899",
  CAA: "#14b8a6",
};

export interface DNSTypeBadgeProps {
  type: string;
}

export function DNSTypeBadge({ type }: DNSTypeBadgeProps) {
  const color = TYPE_COLORS[type] ?? "#888";
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono font-semibold"
      style={{
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}30`,
      }}
    >
      {type}
    </span>
  );
}
