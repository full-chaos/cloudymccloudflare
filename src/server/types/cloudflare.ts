// Cloudflare API response envelope
export interface CFApiResponse<T> {
  success: boolean;
  result: T;
  errors: CFApiError[];
  messages: CFApiMessage[];
  result_info?: CFResultInfo;
}

export interface CFApiError {
  code: number;
  message: string;
}

export interface CFApiMessage {
  code: number;
  message: string;
}

export interface CFResultInfo {
  page: number;
  per_page: number;
  count: number;
  total_count: number;
  total_pages: number;
}

// ─── Zone ─────────────────────────────────────────────────────────────────────

export interface CFZone {
  id: string;
  name: string;
  status: "active" | "pending" | "initializing" | "moved" | "deleted" | "deactivated";
  paused: boolean;
  type: "full" | "partial" | "secondary";
  development_mode: number;
  name_servers: string[];
  original_name_servers: string[];
  original_registrar: string;
  original_dnshost: string;
  modified_on: string;
  created_on: string;
  activated_on: string;
  meta: {
    step: number;
    custom_certificate_quota: number;
    page_rule_quota: number;
    phishing_detected: boolean;
    multiple_railguns_allowed: boolean;
  };
  owner: {
    id: string;
    type: string;
    email: string;
  };
  account: {
    id: string;
    name: string;
  };
  permissions: string[];
  plan: {
    id: string;
    name: string;
    price: number;
    currency: string;
    frequency: string;
    is_subscribed: boolean;
    can_subscribe: boolean;
    legacy_id: string;
    legacy_discount: boolean;
    externally_managed: boolean;
  };
}

// ─── DNS Record ───────────────────────────────────────────────────────────────

export interface CFDNSRecord {
  id: string;
  zone_id: string;
  zone_name: string;
  name: string;
  type: string;
  content: string;
  proxiable: boolean;
  proxied: boolean;
  ttl: number;
  locked: boolean;
  meta: {
    auto_added: boolean;
    source: string;
  };
  created_on: string;
  modified_on: string;
  priority?: number;
  data?: Record<string, unknown>;
}

export interface CFCreateDNSRecord {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
  data?: Record<string, unknown>;
}

export interface CFUpdateDNSRecord {
  type?: string;
  name?: string;
  content?: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
  data?: Record<string, unknown>;
}

// ─── Batch DNS ────────────────────────────────────────────────────────────────

export interface CFBatchDNSPost {
  type: string;
  name: string;
  content: string;
  ttl?: number;
  proxied?: boolean;
  priority?: number;
}

export interface CFBatchDNSPatch {
  id: string;
  type?: string;
  name?: string;
  content?: string;
  ttl?: number;
  proxied?: boolean;
}

export interface CFBatchDNSDelete {
  id: string;
}

export interface CFBatchDNSRequest {
  posts?: CFBatchDNSPost[];
  patches?: CFBatchDNSPatch[];
  deletes?: CFBatchDNSDelete[];
}

export interface CFBatchDNSResult {
  posts?: CFDNSRecord[];
  patches?: CFDNSRecord[];
  deletes?: { id: string }[];
}

// ─── Rulesets / WAF ──────────────────────────────────────────────────────────

export interface CFRule {
  id?: string;
  version?: string;
  action: string;
  action_parameters?: Record<string, unknown>;
  expression: string;
  description: string;
  last_updated?: string;
  ref?: string;
  enabled: boolean;
  categories?: string[];
}

export interface CFRuleset {
  id: string;
  name: string;
  description: string;
  kind: string;
  version: string;
  last_updated: string;
  phase: string;
  rules: CFRule[];
}

export interface CFCreateRule {
  action: string;
  action_parameters?: Record<string, unknown>;
  expression: string;
  description: string;
  enabled: boolean;
}

// ─── Zone Settings ────────────────────────────────────────────────────────────

export interface CFZoneSetting {
  id: string;
  value: unknown;
  modified_on: string;
  editable: boolean;
  time_remaining?: number;
}

// ─── IP Access Rules ──────────────────────────────────────────────────────────

export type CFIPAccessRuleMode = "block" | "challenge" | "whitelist" | "js_challenge" | "managed_challenge";

export interface CFIPAccessRule {
  id: string;
  notes: string;
  allowed_modes: CFIPAccessRuleMode[];
  mode: CFIPAccessRuleMode;
  configuration: {
    target: "ip" | "ip_range" | "asn" | "country";
    value: string;
  };
  scope: {
    id: string;
    name: string;
    type: string;
  };
  created_on: string;
  modified_on: string;
}

export interface CFCreateIPAccessRule {
  mode: CFIPAccessRuleMode;
  configuration: {
    target: "ip" | "ip_range" | "asn" | "country";
    value: string;
  };
  notes?: string;
}
