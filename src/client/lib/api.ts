import type {
  Zone,
  DNSRecord,
  CreateDNSInput,
  UpdateDNSInput,
  BatchDNSInput,
  Group,
  CustomRule,
  DeployPayload,
  DeploymentLogEntry,
  RuleTemplate,
  ZoneBatchResult,
  ApiResponse,
  AnalyticsRange,
  AccountAnalytics,
  GroupAnalytics,
  ClusterAnalytics,
  ZoneAnalytics,
  AnalyticsStatus,
} from "../types";

// ─── Base Fetch Wrapper ───────────────────────────────────────────────────────

const BASE_URL = "/api";

interface AnalyticsOptions {
  includePerZoneSeries?: boolean;
}

function analyticsPath(path: string, range: AnalyticsRange, options?: AnalyticsOptions): string {
  const params = new URLSearchParams({ range });
  if (options?.includePerZoneSeries) {
    params.set("include", "perZoneSeries");
  }
  return `${path}?${params.toString()}`;
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public errors?: { code: number; message: string }[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    let errorData: ApiResponse<unknown> | null = null;
    try {
      errorData = await response.json();
    } catch {
      // ignore parse errors
    }

    const message =
      errorData?.errors?.[0]?.message ?? `HTTP ${response.status}: ${response.statusText}`;
    throw new ApiError(response.status, message, errorData?.errors);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    const message = data.errors?.[0]?.message ?? "Request failed";
    throw new ApiError(response.status, message, data.errors);
  }

  return data.result as T;
}

export async function get<T>(path: string): Promise<T> {
  return request<T>("GET", path);
}

export async function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("POST", path, body);
}

export async function put<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PUT", path, body);
}

export async function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("PATCH", path, body);
}

export async function del<T>(path: string, body?: unknown): Promise<T> {
  return request<T>("DELETE", path, body);
}

// ─── API Namespaces ───────────────────────────────────────────────────────────

export const api = {
  // ─── Zones ──────────────────────────────────────────────────────────────────
  zones: {
    list(): Promise<Zone[]> {
      return get<Zone[]>("/zones");
    },

    get(zoneId: string): Promise<Zone> {
      return get<Zone>(`/zones/${zoneId}`);
    },
  },

  // ─── DNS ────────────────────────────────────────────────────────────────────
  // Server routes: app.route("/api/dns", dns) → /api/dns/:zoneId, etc.
  dns: {
    list(zoneId: string): Promise<DNSRecord[]> {
      return get<DNSRecord[]>(`/dns/${zoneId}`);
    },

    create(zoneId: string, input: CreateDNSInput): Promise<DNSRecord> {
      return post<DNSRecord>(`/dns/${zoneId}`, input);
    },

    update(zoneId: string, recordId: string, input: UpdateDNSInput): Promise<DNSRecord> {
      return patch<DNSRecord>(`/dns/${zoneId}/${recordId}`, input);
    },

    delete(zoneId: string, recordId: string): Promise<void> {
      return del<void>(`/dns/${zoneId}/${recordId}`);
    },

    batch(
      zoneIds: string[],
      input: BatchDNSInput
    ): Promise<ZoneBatchResult<{ posts?: DNSRecord[]; patches?: DNSRecord[]; deletes?: { id: string }[] }>[]> {
      return post(`/dns/batch`, { zoneIds, records: input });
    },
  },

  // ─── Groups ─────────────────────────────────────────────────────────────────
  // Server routes: app.route("/api/groups", groups)
  groups: {
    list(): Promise<Group[]> {
      return get<Group[]>("/groups");
    },

    get(groupId: string): Promise<Group> {
      return get<Group>(`/groups/${groupId}`);
    },

    create(input: { name: string; color: string; description?: string }): Promise<Group> {
      return post<Group>("/groups", input);
    },

    update(
      groupId: string,
      input: { name?: string; color?: string; description?: string; zoneIds?: string[] }
    ): Promise<Group> {
      return put<Group>(`/groups/${groupId}`, input);
    },

    delete(groupId: string): Promise<void> {
      return del<void>(`/groups/${groupId}`);
    },

    addZone(groupId: string, zoneId: string, zoneName: string): Promise<Group> {
      // Server expects { zones: [{zoneId, zoneName}] } — see addZonesToGroupSchema.
      return post<Group>(`/groups/${groupId}/zones`, { zones: [{ zoneId, zoneName }] });
    },

    removeZone(groupId: string, zoneId: string): Promise<Group> {
      return del<Group>(`/groups/${groupId}/zones`, { zoneIds: [zoneId] });
    },
  },

  // ─── Security ───────────────────────────────────────────────────────────────
  // Server routes: app.route("/api/security", security) → /api/security/:zoneId/rules, etc.
  security: {
    deploy(
      zoneId: string,
      rules: CustomRule[]
    ): Promise<CustomRule[]> {
      return post(`/security/${zoneId}/rules`, { rules });
    },

    deployBatch(payload: DeployPayload): Promise<DeploymentLogEntry[]> {
      return post<DeploymentLogEntry[]>("/security/deploy", payload);
    },

    getRules(zoneId: string): Promise<CustomRule[]> {
      return get<CustomRule[]>(`/security/${zoneId}/rules`);
    },

    deleteRule(zoneId: string, ruleId: string): Promise<void> {
      return del<void>(`/security/${zoneId}/rules/${ruleId}`);
    },

    getDeploymentLog(): Promise<DeploymentLogEntry[]> {
      return get<DeploymentLogEntry[]>("/security/deployments");
    },
  },

  // ─── Templates ──────────────────────────────────────────────────────────────
  // Server routes: app.route("/api/templates", templates) → /api/templates
  templates: {
    list(): Promise<RuleTemplate[]> {
      return get<RuleTemplate[]>("/templates");
    },
  },

  // ─── Analytics ──────────────────────────────────────────────────────────────
  // Server routes: app.route("/api/analytics", analytics)
  analytics: {
    account(range: AnalyticsRange, options?: AnalyticsOptions): Promise<AccountAnalytics> {
      return get<AccountAnalytics>(analyticsPath("/analytics/account", range, options));
    },

    group(groupId: string, range: AnalyticsRange, options?: AnalyticsOptions): Promise<GroupAnalytics> {
      return get<GroupAnalytics>(analyticsPath(`/analytics/group/${groupId}`, range, options));
    },

    cluster(name: string, range: AnalyticsRange, options?: AnalyticsOptions): Promise<ClusterAnalytics> {
      return get<ClusterAnalytics>(
        analyticsPath(`/analytics/cluster/${encodeURIComponent(name)}`, range, options)
      );
    },

    zone(zoneId: string, range: AnalyticsRange): Promise<ZoneAnalytics> {
      return get<ZoneAnalytics>(`/analytics/zone/${zoneId}?range=${range}`);
    },

    status(): Promise<AnalyticsStatus> {
      return get<AnalyticsStatus>("/analytics/status");
    },

    refresh(): Promise<{ rowsUpserted: number; zonesQueried: number }> {
      return post<{ rowsUpserted: number; zonesQueried: number }>("/analytics/refresh");
    },
  },
};

export { ApiError };
export type { ApiResponse };
