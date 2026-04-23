import type { DNSRecord } from "../../types";
import { EmptyState } from "../shared/EmptyState";
import { DNSTypeBadge } from "./DNSTypeBadge";

export interface DNSRecordsTableProps {
  records: DNSRecord[];
  onDelete: (record: DNSRecord) => void;
}

function isOptimisticRecord(id: string): boolean {
  return id.startsWith("optimistic-");
}

export function DNSRecordsTable({ records, onDelete }: DNSRecordsTableProps) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon="◈"
        title="No DNS records"
        description="This zone has no DNS records, or they couldn't be loaded."
      />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              Type
            </th>
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              Name
            </th>
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              Content
            </th>
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              Proxy
            </th>
            <th className="text-left py-2.5 px-3 font-display font-semibold text-text-muted uppercase tracking-wider text-[10px]">
              TTL
            </th>
            <th className="py-2.5 px-3" />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const pending = isOptimisticRecord(record.id);
            return (
              <tr
                key={record.id}
                className={`border-b border-border/50 hover:bg-bg-tertiary/50 transition-colors ${
                  pending ? "opacity-60" : ""
                }`}
                aria-busy={pending || undefined}
              >
                <td className="py-2.5 px-3">
                  <DNSTypeBadge type={record.type} />
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-mono text-text-primary">{record.name}</span>
                </td>
                <td className="py-2.5 px-3 max-w-[240px]">
                  <span
                    className="font-mono text-text-secondary truncate block"
                    title={record.content}
                  >
                    {record.content}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  {record.proxied ? (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-accent" />
                      <span className="font-display text-accent text-[11px]">On</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-text-muted" />
                      <span className="font-display text-text-muted text-[11px]">Off</span>
                    </div>
                  )}
                </td>
                <td className="py-2.5 px-3">
                  <span className="font-mono text-text-muted">
                    {record.ttl === 1 ? "Auto" : record.ttl}
                  </span>
                </td>
                <td className="py-2.5 px-3">
                  <button
                    onClick={() => onDelete(record)}
                    disabled={pending}
                    className="text-text-muted hover:text-red-400 transition-colors p-1 rounded hover:bg-red-400/10 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={pending ? "Saving..." : "Delete record"}
                  >
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                      <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
                    </svg>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
