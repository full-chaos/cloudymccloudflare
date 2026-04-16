import type {
  CFApiResponse,
  CFZone,
  CFDNSRecord,
  CFCreateDNSRecord,
  CFUpdateDNSRecord,
  CFBatchDNSRequest,
  CFBatchDNSResult,
  CFRule,
  CFRuleset,
  CFZoneSetting,
  CFIPAccessRule,
  CFCreateIPAccessRule,
} from "../types/cloudflare";

const CF_API_BASE = "https://api.cloudflare.com/client/v4";

// ─── Rate Limit Queue ─────────────────────────────────────────────────────────

class ConcurrencyQueue {
  private concurrency: number;
  private running = 0;
  private queue: Array<() => void> = [];

  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (this.running < this.concurrency) {
        this.running++;
        resolve();
      } else {
        this.queue.push(() => {
          this.running++;
          resolve();
        });
      }
    });
  }

  private release(): void {
    this.running--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// ─── Cloudflare API Client ────────────────────────────────────────────────────

export class CloudflareClient {
  private apiToken: string;
  private accountId: string;
  private queue: ConcurrencyQueue;

  constructor(apiToken: string, accountId: string) {
    this.apiToken = apiToken;
    this.accountId = accountId;
    this.queue = new ConcurrencyQueue(4);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retries = 3
  ): Promise<T> {
    const url = `${CF_API_BASE}${path}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body !== undefined && method !== "GET" && method !== "DELETE") {
      options.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, options);

        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.pow(2, attempt) * 1000;

          if (attempt < retries - 1) {
            await sleep(waitMs);
            continue;
          }
        }

        // For DELETE with no body, just check success status
        if (method === "DELETE" && response.status === 200) {
          return undefined as T;
        }

        const data = (await response.json()) as CFApiResponse<T>;

        if (!data.success) {
          const errorMsg = data.errors
            .map((e) => `[${e.code}] ${e.message}`)
            .join("; ");
          throw new CloudflareApiError(errorMsg, data.errors[0]?.code ?? 0, response.status);
        }

        return data.result;
      } catch (err) {
        if (err instanceof CloudflareApiError) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < retries - 1) {
          await sleep(Math.pow(2, attempt) * 500);
        }
      }
    }

    throw lastError ?? new Error(`Request to ${path} failed after ${retries} attempts`);
  }

  // ─── GraphQL (Analytics API) ────────────────────────────────────────────────

  /**
   * Execute a GraphQL query against the Cloudflare Analytics API.
   * The GraphQL endpoint uses a different response envelope than REST
   * (`{ data, errors }` vs `{ success, result, errors }`) so we can't reuse
   * `request<T>` which hardcodes the REST envelope check.
   * Shares the concurrency queue + exponential backoff retry logic.
   */
  async graphql<T>(
    query: string,
    variables: Record<string, unknown> = {},
    retries = 3,
  ): Promise<T> {
    return this.queue.run(async () => {
      const url = `${CF_API_BASE}/graphql`;
      const body = JSON.stringify({ query, variables });

      let lastError: Error | null = null;

      for (let attempt = 0; attempt < retries; attempt++) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${this.apiToken}`,
              "Content-Type": "application/json",
            },
            body,
          });

          if (response.status === 429) {
            const retryAfter = response.headers.get("Retry-After");
            const waitMs = retryAfter
              ? parseInt(retryAfter, 10) * 1000
              : Math.pow(2, attempt) * 1000;
            if (attempt < retries - 1) {
              await sleep(waitMs);
              continue;
            }
          }

          const payload = (await response.json()) as CFGraphQLResponse<T>;

          if (payload.errors && payload.errors.length > 0) {
            const errMsg = payload.errors.map((e) => e.message).join("; ");
            throw new CloudflareApiError(
              `GraphQL error: ${errMsg}`,
              0,
              response.status,
            );
          }

          if (!response.ok || !payload.data) {
            throw new CloudflareApiError(
              `GraphQL request failed (HTTP ${response.status})`,
              0,
              response.status,
            );
          }

          return payload.data;
        } catch (err) {
          if (err instanceof CloudflareApiError) {
            // Don't retry auth/schema errors (we'd just keep failing).
            throw err;
          }
          lastError = err instanceof Error ? err : new Error(String(err));
          if (attempt < retries - 1) {
            await sleep(Math.pow(2, attempt) * 500);
          }
        }
      }

      throw lastError ?? new Error(`GraphQL request failed after ${retries} attempts`);
    });
  }

  // ─── Zones ──────────────────────────────────────────────────────────────────

  async listZones(): Promise<CFZone[]> {
    const zones: CFZone[] = [];
    let page = 1;
    const perPage = 50;

    while (true) {
      const path = `/zones?account.id=${this.accountId}&page=${page}&per_page=${perPage}&status=active`;
      const data = await this.requestWithEnvelope<CFZone[]>("GET", path);
      zones.push(...data.result);

      const info = data.result_info;
      if (!info || page >= info.total_pages) break;

      page++;
    }

    return zones;
  }

  async getZone(zoneId: string): Promise<CFZone> {
    return this.request<CFZone>("GET", `/zones/${zoneId}`);
  }

  // ─── DNS Records ─────────────────────────────────────────────────────────────

  async listDNSRecords(zoneId: string): Promise<CFDNSRecord[]> {
    const records: CFDNSRecord[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const path = `/zones/${zoneId}/dns_records?page=${page}&per_page=${perPage}`;
      const data = await this.requestWithEnvelope<CFDNSRecord[]>("GET", path);
      records.push(...data.result);

      const info = data.result_info;
      if (!info || page >= info.total_pages) break;

      page++;
    }

    return records;
  }

  async createDNSRecord(zoneId: string, record: CFCreateDNSRecord): Promise<CFDNSRecord> {
    return this.request<CFDNSRecord>("POST", `/zones/${zoneId}/dns_records`, record);
  }

  async updateDNSRecord(
    zoneId: string,
    recordId: string,
    record: CFUpdateDNSRecord
  ): Promise<CFDNSRecord> {
    return this.request<CFDNSRecord>(
      "PATCH",
      `/zones/${zoneId}/dns_records/${recordId}`,
      record
    );
  }

  async deleteDNSRecord(zoneId: string, recordId: string): Promise<void> {
    await this.request<{ id: string }>("DELETE", `/zones/${zoneId}/dns_records/${recordId}`);
  }

  async batchDNSRecords(zoneId: string, batch: CFBatchDNSRequest): Promise<CFBatchDNSResult> {
    return this.request<CFBatchDNSResult>(
      "POST",
      `/zones/${zoneId}/dns_records/batch`,
      batch
    );
  }

  // ─── WAF / Rulesets ──────────────────────────────────────────────────────────

  async getCustomWAFRules(zoneId: string): Promise<CFRuleset> {
    try {
      // Get the http_request_firewall_custom phase ruleset
      const rulesets = await this.request<CFRuleset[]>(
        "GET",
        `/zones/${zoneId}/rulesets`
      );

      const customRuleset = Array.isArray(rulesets)
        ? rulesets.find(
            (r) => r.phase === "http_request_firewall_custom" && r.kind === "zone"
          )
        : undefined;

      if (!customRuleset) {
        // Return an empty ruleset if none exists yet
        return {
          id: "",
          name: "Custom Firewall Rules",
          description: "",
          kind: "zone",
          version: "1",
          last_updated: new Date().toISOString(),
          phase: "http_request_firewall_custom",
          rules: [],
        };
      }

      // Fetch the full ruleset with all rules
      return this.request<CFRuleset>(
        "GET",
        `/zones/${zoneId}/rulesets/${customRuleset.id}`
      );
    } catch (err) {
      if (err instanceof CloudflareApiError && err.statusCode === 404) {
        return {
          id: "",
          name: "Custom Firewall Rules",
          description: "",
          kind: "zone",
          version: "1",
          last_updated: new Date().toISOString(),
          phase: "http_request_firewall_custom",
          rules: [],
        };
      }
      throw err;
    }
  }

  async setCustomWAFRules(zoneId: string, rules: CFRule[]): Promise<CFRuleset> {
    // First check if a custom ruleset already exists
    let rulesetId: string | null = null;

    try {
      const rulesets = await this.request<CFRuleset[]>(
        "GET",
        `/zones/${zoneId}/rulesets`
      );

      if (Array.isArray(rulesets)) {
        const existing = rulesets.find(
          (r) => r.phase === "http_request_firewall_custom" && r.kind === "zone"
        );
        if (existing) rulesetId = existing.id;
      }
    } catch {
      // Ignore errors; we'll create a new ruleset
    }

    if (rulesetId) {
      // Update existing ruleset
      return this.request<CFRuleset>(
        "PUT",
        `/zones/${zoneId}/rulesets/${rulesetId}`,
        {
          rules,
        }
      );
    } else {
      // Create new phase ruleset
      return this.request<CFRuleset>(
        "POST",
        `/zones/${zoneId}/rulesets`,
        {
          name: "Custom Firewall Rules",
          description: "Managed by CloudlyMcCloudFlare",
          kind: "zone",
          phase: "http_request_firewall_custom",
          rules,
        }
      );
    }
  }

  // ─── Zone Settings ───────────────────────────────────────────────────────────

  async getZoneSettings(zoneId: string): Promise<CFZoneSetting[]> {
    return this.request<CFZoneSetting[]>("GET", `/zones/${zoneId}/settings`);
  }

  async updateZoneSetting(
    zoneId: string,
    settingId: string,
    value: unknown
  ): Promise<CFZoneSetting> {
    return this.request<CFZoneSetting>(
      "PATCH",
      `/zones/${zoneId}/settings/${settingId}`,
      { value }
    );
  }

  // ─── IP Access Rules ─────────────────────────────────────────────────────────

  async listIPAccessRules(zoneId: string): Promise<CFIPAccessRule[]> {
    const rules: CFIPAccessRule[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const path =
        `/zones/${zoneId}/firewall/access_rules/rules?page=${page}&per_page=${perPage}`;
      const data = await this.requestWithEnvelope<CFIPAccessRule[]>("GET", path);
      rules.push(...data.result);

      const info = data.result_info;
      if (!info || page >= info.total_pages) break;

      page++;
    }

    return rules;
  }

  async createIPAccessRule(
    zoneId: string,
    rule: CFCreateIPAccessRule
  ): Promise<CFIPAccessRule> {
    return this.request<CFIPAccessRule>(
      "POST",
      `/zones/${zoneId}/firewall/access_rules/rules`,
      rule
    );
  }

  // ─── Batch operations with rate-limiting ─────────────────────────────────────

  /**
   * Run an operation across multiple zones with concurrency=4 rate limiting.
   * Returns results (or errors) per zone.
   */
  async batchZoneOperation<T>(
    zoneIds: string[],
    operation: (zoneId: string) => Promise<T>
  ): Promise<Array<{ zoneId: string; result?: T; error?: string }>> {
    const tasks = zoneIds.map((zoneId) =>
      this.queue.run(async () => {
        try {
          const result = await operation(zoneId);
          return { zoneId, result };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return { zoneId, error: message };
        }
      })
    );

    return Promise.all(tasks);
  }

  private async requestWithEnvelope<T>(
    method: string,
    path: string,
    body?: unknown,
    retries = 3,
  ): Promise<CFApiResponse<T>> {
    const url = `${CF_API_BASE}${path}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        "Content-Type": "application/json",
      },
    };

    if (body !== undefined && method !== "GET" && method !== "DELETE") {
      options.body = JSON.stringify(body);
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, options);

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.pow(2, attempt) * 1000;

          if (attempt < retries - 1) {
            await sleep(waitMs);
            continue;
          }
        }

        const data = (await response.json()) as CFApiResponse<T>;

        if (!data.success) {
          const errorMsg = data.errors.map((e) => `[${e.code}] ${e.message}`).join("; ");
          throw new CloudflareApiError(errorMsg, data.errors[0]?.code ?? 0, response.status);
        }

        return data;
      } catch (err) {
        if (err instanceof CloudflareApiError) {
          throw err;
        }
        lastError = err instanceof Error ? err : new Error(String(err));

        if (attempt < retries - 1) {
          await sleep(Math.pow(2, attempt) * 500);
        }
      }
    }

    throw lastError ?? new Error(`Request to ${path} failed after ${retries} attempts`);
  }
}

// ─── GraphQL Response Envelope ───────────────────────────────────────────────

interface CFGraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: string[]; extensions?: unknown }>;
}

// ─── Error Class ─────────────────────────────────────────────────────────────

export class CloudflareApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "CloudflareApiError";
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
