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
  name: string;
  description: string;
  expression: string;
  action: RuleAction;
  category?: string;
}

export interface CustomRule {
  id?: string;
  expression: string;
  action: RuleAction;
  description: string;
  enabled?: boolean;
}

// ─── Deployment ───────────────────────────────────────────────────────────────

export interface DeployTarget {
  type: "zones" | "group";
  ids: string[];
}

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
