import { useState } from "react";
import type * as React from "react";
import type { CreateDNSInput, DNSRecord, DNSRecordType } from "../../types";
import { DNS_RECORD_TYPES } from "../../../shared/constants";

const TTL_OPTIONS = [
  { label: "Auto", value: 1 },
  { label: "1 min", value: 60 },
  { label: "2 min", value: 120 },
  { label: "5 min", value: 300 },
  { label: "15 min", value: 900 },
  { label: "30 min", value: 1800 },
  { label: "1 hour", value: 3600 },
  { label: "2 hours", value: 7200 },
  { label: "4 hours", value: 14400 },
  { label: "1 day", value: 86400 },
];

const INITIAL_FORM: CreateDNSInput = {
  type: "A",
  name: "@",
  content: "",
  ttl: 1,
  proxied: false,
};

const PROXIABLE_TYPES = new Set<DNSRecordType>(["A", "AAAA", "CNAME"]);
const PRIORITY_TYPES = new Set<DNSRecordType>(["MX"]);

/** Form values for an existing record, so the edit form starts prefilled. */
export function recordToInput(record: DNSRecord): CreateDNSInput {
  return {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: record.ttl,
    proxied: record.proxied,
    priority: record.priority,
  };
}

/** Only the fields that changed, so a PATCH never rewrites untouched values. */
export function changedFields(record: DNSRecord, input: CreateDNSInput): Partial<CreateDNSInput> {
  const before = recordToInput(record);
  const patch: Partial<CreateDNSInput> = {};
  for (const key of Object.keys(input) as (keyof CreateDNSInput)[]) {
    if (input[key] !== undefined && input[key] !== before[key]) {
      (patch as Record<string, unknown>)[key] = input[key];
    }
  }
  return patch;
}

export interface AddRecordFormProps {
  onSubmit: (input: CreateDNSInput) => Promise<void>;
  loading: boolean;
  /** Prefill for editing. Without it the form adds a new record and resets after submit. */
  initial?: CreateDNSInput;
  title?: string;
  submitLabel?: string;
}

export function AddRecordForm({
  onSubmit,
  loading,
  initial,
  title = "Add Record",
  submitLabel = "Add Record",
}: AddRecordFormProps) {
  const [form, setForm] = useState<CreateDNSInput>(initial ?? INITIAL_FORM);

  const setField = <K extends keyof CreateDNSInput>(k: K, v: CreateDNSInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const needsPriority = PRIORITY_TYPES.has(form.type);
  const canSubmit =
    form.name.trim().length > 0 &&
    form.content.trim().length > 0 &&
    (!needsPriority || form.priority !== undefined);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit) return;
    const input: CreateDNSInput = { ...form };
    if (!PROXIABLE_TYPES.has(input.type)) input.proxied = false;
    if (!needsPriority) delete input.priority;
    await onSubmit(input);
    if (!initial) setForm(INITIAL_FORM);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-bg-secondary border border-border rounded-[10px] p-4 space-y-3"
    >
      <h3 className="text-xs font-semibold font-display text-text-secondary uppercase tracking-wider">
        {title}
      </h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-display text-text-muted mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setField("type", e.target.value as DNSRecordType)}
            className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:border-accent/50 font-mono"
          >
            {DNS_RECORD_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-display text-text-muted mb-1">TTL</label>
          <select
            value={form.ttl}
            onChange={(e) => setField("ttl", Number(e.target.value))}
            className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:border-accent/50 font-mono"
          >
            {TTL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-display text-text-muted mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="@ or subdomain"
            className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-display text-text-muted mb-1">Content</label>
          <input
            type="text"
            value={form.content}
            onChange={(e) => setField("content", e.target.value)}
            placeholder="IP or value"
            className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
          />
        </div>

        {needsPriority && (
          <div>
            <label className="block text-xs font-display text-text-muted mb-1">Priority</label>
            <input
              type="number"
              min={0}
              max={65535}
              value={form.priority ?? ""}
              onChange={(e) =>
                setField("priority", e.target.value === "" ? undefined : Number(e.target.value))
              }
              placeholder="10"
              className="w-full px-2 py-1.5 text-xs bg-bg-primary border border-border rounded text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 font-mono"
            />
          </div>
        )}
      </div>

      {PROXIABLE_TYPES.has(form.type) && (
        <label className="flex items-center gap-2 cursor-pointer">
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(form.proxied)}
            className={`relative w-8 h-4 rounded-full transition-colors ${
              form.proxied ? "bg-accent" : "bg-border"
            }`}
            onClick={() => setField("proxied", !form.proxied)}
          >
            <div
              className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                form.proxied ? "translate-x-4" : "translate-x-0.5"
              }`}
            />
          </button>
          <span className="text-xs font-display text-text-secondary">Proxied (Cloudflare)</span>
        </label>
      )}

      <button
        type="submit"
        disabled={loading || !canSubmit}
        className="w-full py-2 text-xs font-semibold text-white rounded-lg btn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
