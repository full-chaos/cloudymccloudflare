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
  ZoneBatchResult,
  ZoneSetting,
  ApiResponse,
  AnalyticsRange,
  ZoneMetrics,
  AccountTotals,
  AccountAnalytics,
  GroupAnalytics,
  ClusterAnalytics,
  ZoneTimeSeriesPoint,
  ZoneAnalytics,
  AnalyticsStatus,
  DomainCluster,
  AnalyticsDimensionAggregate,
  AnalyticsDimensionKey,
  AnalyticsScope,
} from "../../shared/types";

export type ViewType = "dashboard" | "groups" | "dns" | "security" | "templates" | "analytics";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

export interface DeployLogEntry {
  id: string;
  zoneId: string;
  zoneName: string;
  ruleName: string;
  status: "queued" | "deployed" | "error";
  timestamp: string;
  errorMessage?: string;
}
