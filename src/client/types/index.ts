// Re-export all shared types
export type {
  Zone,
  DNSRecord,
  DNSRecordType,
  CreateDNSInput,
  UpdateDNSInput,
  BatchDNSInput,
  Group,
  RuleAction,
  RuleTemplate,
  CustomRule,
  DeployTarget,
  DeployPayload,
  DeploymentLogEntry,
  ZoneSetting,
  ApiResponse,
  AnalyticsRange,
  ZoneMetrics,
  AccountTotals,
  AccountAnalytics,
  GroupAnalytics,
  ZoneTimeSeriesPoint,
  ZoneAnalytics,
  AnalyticsStatus,
} from "../../shared/types";

// ─── UI-Specific Types ────────────────────────────────────────────────────────

export type ViewType = "dashboard" | "groups" | "dns" | "security" | "templates" | "analytics";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface NavItem {
  id: ViewType;
  label: string;
  icon: string;
}

// ─── DNS Deployment ───────────────────────────────────────────────────────────

export interface DeployLogEntry {
  id: string;
  zoneId: string;
  zoneName: string;
  ruleName: string;
  status: "queued" | "deployed" | "error";
  timestamp: string;
  errorMessage?: string;
}

// ─── Domain Cluster ───────────────────────────────────────────────────────────

export interface DomainCluster {
  baseName: string;
  zones: import("../../shared/types").Zone[];
}

// ─── Form State ───────────────────────────────────────────────────────────────

export interface CreateGroupForm {
  name: string;
  color: string;
}

export interface CreateDNSForm {
  type: import("../../shared/types").DNSRecordType;
  name: string;
  content: string;
  ttl: number;
  proxied: boolean;
  priority?: number;
}

export interface SecurityRuleForm {
  name: string;
  expression: string;
  action: import("../../shared/types").RuleAction;
}

// ─── API State ────────────────────────────────────────────────────────────────

export type LoadingState = "idle" | "loading" | "success" | "error";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}
