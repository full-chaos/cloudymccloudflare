import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import type { Group } from "../types";

export interface UseGroupsReturn {
  groups: Group[];
  loading: boolean;
  error: string | null;
  createGroup: (name: string, color: string, description?: string) => Promise<Group>;
  updateGroup: (
    groupId: string,
    updates: { name?: string; color?: string; description?: string; zoneIds?: string[] }
  ) => Promise<Group>;
  deleteGroup: (groupId: string) => Promise<void>;
  addZoneToGroup: (groupId: string, zoneId: string) => Promise<void>;
  removeZoneFromGroup: (groupId: string, zoneId: string) => Promise<void>;
  refresh: () => Promise<void>;
  getGroupById: (id: string) => Group | undefined;
  getGroupsForZone: (zoneId: string) => Group[];
}

export function useGroups(): UseGroupsReturn {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.groups.list();
      setGroups(data);
    } catch {
      // API unavailable — groups stay in local state only
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const createGroup = useCallback(
    async (name: string, color: string, description?: string): Promise<Group> => {
      // Optimistic: add placeholder
      const tempId = `temp-${Date.now()}`;
      const tempGroup: Group = {
        id: tempId,
        name,
        color,
        description,
        zoneIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setGroups((prev) => [...prev, tempGroup]);

      try {
        const created = await api.groups.create({ name, color, description });
        setGroups((prev) =>
          prev.map((g) => (g.id === tempId ? created : g))
        );
        return created;
      } catch {
        // API unavailable — keep the optimistic group (local-only mode)
        return tempGroup;
      }
    },
    []
  );

  const updateGroup = useCallback(
    async (
      groupId: string,
      updates: { name?: string; color?: string; description?: string; zoneIds?: string[] }
    ): Promise<Group> => {
      // Optimistic update
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, ...updates, updatedAt: new Date().toISOString() }
            : g
        )
      );

      try {
        const updated = await api.groups.update(groupId, updates);
        setGroups((prev) =>
          prev.map((g) => (g.id === groupId ? updated : g))
        );
        return updated;
      } catch (err) {
        // Refetch to restore state
        await fetchGroups();
        throw err;
      }
    },
    [fetchGroups]
  );

  const deleteGroup = useCallback(
    async (groupId: string): Promise<void> => {
      // Optimistic delete
      const prevGroups = [...groups];
      setGroups((prev) => prev.filter((g) => g.id !== groupId));

      try {
        await api.groups.delete(groupId);
      } catch (err) {
        // Roll back
        setGroups(prevGroups);
        throw err;
      }
    },
    [groups]
  );

  const addZoneToGroup = useCallback(
    async (groupId: string, zoneId: string): Promise<void> => {
      // Optimistic update
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId && !g.zoneIds.includes(zoneId)
            ? { ...g, zoneIds: [...g.zoneIds, zoneId] }
            : g
        )
      );

      try {
        const updated = await api.groups.addZone(groupId, zoneId);
        setGroups((prev) =>
          prev.map((g) => (g.id === groupId ? updated : g))
        );
      } catch (err) {
        await fetchGroups();
        throw err;
      }
    },
    [fetchGroups]
  );

  const removeZoneFromGroup = useCallback(
    async (groupId: string, zoneId: string): Promise<void> => {
      // Optimistic update
      setGroups((prev) =>
        prev.map((g) =>
          g.id === groupId
            ? { ...g, zoneIds: g.zoneIds.filter((id) => id !== zoneId) }
            : g
        )
      );

      try {
        const updated = await api.groups.removeZone(groupId, zoneId);
        setGroups((prev) =>
          prev.map((g) => (g.id === groupId ? updated : g))
        );
      } catch (err) {
        await fetchGroups();
        throw err;
      }
    },
    [fetchGroups]
  );

  const getGroupById = useCallback(
    (id: string) => groups.find((g) => g.id === id),
    [groups]
  );

  const getGroupsForZone = useCallback(
    (zoneId: string) => groups.filter((g) => g.zoneIds.includes(zoneId)),
    [groups]
  );

  return {
    groups,
    loading,
    error,
    createGroup,
    updateGroup,
    deleteGroup,
    addZoneToGroup,
    removeZoneFromGroup,
    refresh: fetchGroups,
    getGroupById,
    getGroupsForZone,
  };
}
