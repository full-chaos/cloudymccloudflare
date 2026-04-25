// Shared domain types used by both client and server

// ─── Zone ─────────────────────────────────────────────────────────────────────

export interface Zone {
  id: string;
  name: string;
  status: string;
  paused: boolean;
  plan: {
    id: string;
    name: string;
    price: number;
  };
  nameServers: string[];
}

// ─── DNS ──────────────────────────────────────────────────────────────────────

export type DNSRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SRV" | "CAA";

export interface DNSRecord {
  id: string;
  zoneId: string;
  zoneName: string;
  type: DNSRecordType;
  name: string;
  content: string;
  proxied: boolean;
  proxiable: boolean;
  ttl: number;
  priority?: number;
}

export interface CreateDNSInput {
  type: DNSRecordType;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

export type UpdateDNSInput = Partial<CreateDNSInput>;

export interface BatchDNSInput {
  posts?: CreateDNSInput[];
  patches?: ({ id: string } & UpdateDNSInput)[];
  deletes?: { id: string }[];
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export interface Group {
  id: string;
  name: string;
  color: string;
  description?: string;
  zoneIds: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Firewall Rules ───────────────────────────────────────────────────────────

export type RuleAction =
  | "block"
  | "managed_challenge"
  | "js_challenge"
  | "challenge"
  | "skip"
  | "log";

export interface RuleTemplate {
  id?: string;
  name: string;
  description: string;
  expression: string;
  action: RuleAction;
  category?: string;
  isBuiltIn?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CustomRule {
  id?: string;
  expression: string;
  action: RuleAction;
  description: string;
  enabled?: boolean;
}

// ─── Deployment ───────────────────────────────────────────────────────────────

export type DeployTarget =
  | { type: "zones"; ids: string[] }
  | { type: "group"; id: string };

export interface DeployPayload {
  target: DeployTarget;
  rules: CustomRule[];
  mode: "append" | "replace";
}

export interface DeploymentLogEntry {
  id: string;
  zoneId: string;
  zoneName: string;
  ruleType: string;
  ruleName: string;
  action: RuleAction;
  details?: string;
  status: "success" | "failed" | "pending";
  errorMessage?: string;
  createdAt: string;
}

export interface DeployResult {
  zoneId: string;
  zoneName: string;
  status: "success" | "failed";
  errorMessage?: string;
  logEntries: DeploymentLogEntry[];
}

export interface ZoneBatchResult<T = unknown> {
  zoneId: string;
  result?: T;
  error?: string;
}

// ─── Zone Settings ────────────────────────────────────────────────────────────

export interface ZoneSetting {
  id: string;
  value: unknown;
  editable: boolean;
  modifiedOn: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  result?: T;
  errors?: {
    code: number;
    message: string;
  }[];
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export type AnalyticsRange = "24h" | "7d" | "30d";

export interface ZoneMetrics {
  zoneId: string;
  zoneName?: string;
  requests: number;
  bytes: number;
  cachedBytes: number;
  threats: number;
}

export interface AccountTotals {
  requests: number;
  bytes: number;
  cachedBytes: number;
  threats: number;
  cacheHitRatio: number; // 0..1
}

export interface AccountAnalytics {
  range: AnalyticsRange;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  totals: AccountTotals;
  perZone: ZoneMetrics[];
  series: ZoneTimeSeriesPoint[];
  lastFetchedAt: string | null;
  sampleInterval: number; // max across buckets; >1 means CF sampled
}

export interface GroupAnalytics {
  range: AnalyticsRange;
  windowStart: string;
  windowEnd: string;
  groupId: string;
  groupName: string;
  zoneCount: number;
  totals: AccountTotals;
  perZone: ZoneMetrics[];
  lastFetchedAt: string | null;
  sampleInterval: number;
}

export interface ZoneTimeSeriesPoint {
  timestamp: string; // ISO hour
  /**
   * Metric values are `null` for hours outside the fetched range (before the
   * first bucket we ever stored, or after the most recent backfill). Nulls
   * render as gaps in the chart — critical for the activeDot not to pin to a
   * fake flat-zero region. Inside the fetched range, missing-bucket hours are
   * zero (no traffic) rather than null.
   */
  requests: number | null;
  bytes: number | null;
  cachedBytes: number | null;
  threats: number | null;
}

export interface ZoneAnalytics {
  range: AnalyticsRange;
  windowStart: string;
  windowEnd: string;
  zoneId: string;
  zoneName?: string;
  totals: AccountTotals;
  series: ZoneTimeSeriesPoint[];
  lastFetchedAt: string | null;
  sampleInterval: number;
}

export interface AnalyticsStatus {
  lastFetchedAt: string | null;
  rowCount: number;
  lastRunStatus: "success" | "partial" | "error" | "never";
  lastRunError: string | null;
}
