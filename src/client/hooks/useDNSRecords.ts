import { useState, useCallback, useOptimistic, startTransition } from "react";
import { api } from "../lib/api";
import type { DNSRecord, CreateDNSInput, UpdateDNSInput } from "../types";

export interface UseDNSRecordsReturn {
  records: DNSRecord[];
  loading: boolean;
  error: string | null;
  currentZoneId: string | null;
  fetchRecords: (zoneId: string) => Promise<void>;
  createRecord: (zoneId: string, input: CreateDNSInput) => Promise<DNSRecord>;
  updateRecord: (
    zoneId: string,
    recordId: string,
    input: UpdateDNSInput
  ) => Promise<DNSRecord>;
  deleteRecord: (zoneId: string, recordId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

type OptimisticAction =
  | { kind: "add"; record: DNSRecord }
  | { kind: "update"; recordId: string; patch: UpdateDNSInput }
  | { kind: "delete"; recordId: string };

function optimisticReducer(
  state: DNSRecord[],
  action: OptimisticAction
): DNSRecord[] {
  switch (action.kind) {
    case "add":
      return [...state, action.record];
    case "update":
      return state.map((r) =>
        r.id === action.recordId ? { ...r, ...action.patch } : r
      );
    case "delete":
      return state.filter((r) => r.id !== action.recordId);
  }
}

function buildOptimisticRecord(
  zoneId: string,
  input: CreateDNSInput
): DNSRecord {
  const uniq = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: `optimistic-${uniq}`,
    zoneId,
    zoneName: "",
    type: input.type,
    name: input.name,
    content: input.content,
    proxied: input.proxied ?? false,
    proxiable: true,
    ttl: input.ttl ?? 1,
    priority: input.priority,
  };
}

function runAsAction<T>(
  action: (resolve: (value: T) => void, reject: (err: unknown) => void) => Promise<void>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    startTransition(async () => {
      try {
        await action(resolve, reject);
      } catch (err) {
        reject(err);
      }
    });
  });
}

export function useDNSRecords(): UseDNSRecordsReturn {
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [optimisticRecords, applyOptimistic] = useOptimistic(
    records,
    optimisticReducer
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentZoneId, setCurrentZoneId] = useState<string | null>(null);

  const fetchRecords = useCallback(async (zoneId: string) => {
    try {
      setLoading(true);
      setError(null);
      setCurrentZoneId(zoneId);
      const data = await api.dns.list(zoneId);
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch DNS records");
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (currentZoneId) {
      await fetchRecords(currentZoneId);
    }
  }, [currentZoneId, fetchRecords]);

  const createRecord = useCallback(
    (zoneId: string, input: CreateDNSInput): Promise<DNSRecord> =>
      runAsAction<DNSRecord>(async (resolve, reject) => {
        applyOptimistic({ kind: "add", record: buildOptimisticRecord(zoneId, input) });
        try {
          const created = await api.dns.create(zoneId, input);
          setRecords((prev) => [...prev, created]);
          resolve(created);
        } catch (err) {
          reject(err);
        }
      }),
    [applyOptimistic]
  );

  const updateRecord = useCallback(
    (
      zoneId: string,
      recordId: string,
      input: UpdateDNSInput
    ): Promise<DNSRecord> =>
      runAsAction<DNSRecord>(async (resolve, reject) => {
        applyOptimistic({ kind: "update", recordId, patch: input });
        try {
          const updated = await api.dns.update(zoneId, recordId, input);
          setRecords((prev) =>
            prev.map((r) => (r.id === recordId ? updated : r))
          );
          resolve(updated);
        } catch (err) {
          reject(err);
        }
      }),
    [applyOptimistic]
  );

  const deleteRecord = useCallback(
    (zoneId: string, recordId: string): Promise<void> =>
      runAsAction<void>(async (resolve, reject) => {
        applyOptimistic({ kind: "delete", recordId });
        try {
          await api.dns.delete(zoneId, recordId);
          setRecords((prev) => prev.filter((r) => r.id !== recordId));
          resolve();
        } catch (err) {
          reject(err);
        }
      }),
    [applyOptimistic]
  );

  return {
    records: optimisticRecords,
    loading,
    error,
    currentZoneId,
    fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    refresh,
  };
}
