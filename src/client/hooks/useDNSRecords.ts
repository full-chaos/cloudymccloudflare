import { useState, useCallback } from "react";
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

export function useDNSRecords(): UseDNSRecordsReturn {
  const [records, setRecords] = useState<DNSRecord[]>([]);
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
    async (zoneId: string, input: CreateDNSInput): Promise<DNSRecord> => {
      const created = await api.dns.create(zoneId, input);
      setRecords((prev) => [...prev, created]);
      return created;
    },
    []
  );

  const updateRecord = useCallback(
    async (
      zoneId: string,
      recordId: string,
      input: UpdateDNSInput
    ): Promise<DNSRecord> => {
      // Optimistic update
      setRecords((prev) =>
        prev.map((r) =>
          r.id === recordId ? { ...r, ...input } : r
        )
      );

      try {
        const updated = await api.dns.update(zoneId, recordId, input);
        setRecords((prev) =>
          prev.map((r) => (r.id === recordId ? updated : r))
        );
        return updated;
      } catch (err) {
        // Refetch to restore state
        await fetchRecords(zoneId);
        throw err;
      }
    },
    [fetchRecords]
  );

  const deleteRecord = useCallback(
    async (zoneId: string, recordId: string): Promise<void> => {
      const prevRecords = [...records];
      setRecords((prev) => prev.filter((r) => r.id !== recordId));

      try {
        await api.dns.delete(zoneId, recordId);
      } catch (err) {
        setRecords(prevRecords);
        throw err;
      }
    },
    [records]
  );

  return {
    records,
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
