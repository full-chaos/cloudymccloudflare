import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../lib/api";
import { ZONES } from "@shared/constants";
import type { Zone } from "../types";

// Convert static zone data to Zone type for fallback
const STATIC_ZONES: Zone[] = ZONES.map((z) => ({
  id: z.id,
  name: z.name,
  status: "active" as const,
  paused: false,
  plan: { id: "free", name: "Free", price: 0 },
  nameServers: [],
}));

export interface UseZonesReturn {
  zones: Zone[];
  filteredZones: Zone[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  refresh: () => Promise<void>;
  getZoneById: (id: string) => Zone | undefined;
  getZoneByName: (name: string) => Zone | undefined;
}

export function useZones(): UseZonesReturn {
  const [zones, setZones] = useState<Zone[]>(STATIC_ZONES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchZones = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.zones.list();
      if (data.length > 0) {
        setZones(data);
      }
    } catch {
      // Fall back to static zones (already set as initial state)
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  const filteredZones = useMemo(() => {
    if (!searchQuery.trim()) return zones;
    const q = searchQuery.toLowerCase();
    return zones.filter(
      (z) =>
        z.name.toLowerCase().includes(q) ||
        z.id.toLowerCase().includes(q) ||
        z.status.toLowerCase().includes(q)
    );
  }, [zones, searchQuery]);

  const getZoneById = useCallback(
    (id: string) => zones.find((z) => z.id === id),
    [zones]
  );

  const getZoneByName = useCallback(
    (name: string) => zones.find((z) => z.name === name),
    [zones]
  );

  return {
    zones,
    filteredZones,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refresh: fetchZones,
    getZoneById,
    getZoneByName,
  };
}
