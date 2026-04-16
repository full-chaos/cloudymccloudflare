import { and, eq, inArray } from "drizzle-orm";
import { nanoid } from "../utils/nanoid";
import type { Database } from "../db";
import { groups, groupZones } from "../db/schema";
import type { Group } from "@shared/types";
import type {
  CreateGroupInput,
  UpdateGroupInput,
  AddZonesToGroupInput,
} from "@shared/validators";

// ─── Group with zones shape ───────────────────────────────────────────────────

export interface GroupWithZones extends Group {
  zones: Array<{ zoneId: string; zoneName: string; addedAt: string }>;
}

// ─── List Groups ──────────────────────────────────────────────────────────────

export async function listGroups(db: Database): Promise<Group[]> {
  const rows = await db.select().from(groups).orderBy(groups.name);

  // Fetch zone counts for each group
  const groupIds = rows.map((g) => g.id);

  if (groupIds.length === 0) return [];

  const zoneRows = await db
    .select({ groupId: groupZones.groupId, zoneId: groupZones.zoneId })
    .from(groupZones)
    .where(inArray(groupZones.groupId, groupIds));

  // Build a map of groupId -> zoneIds
  const zoneMap: Record<string, string[]> = {};
  for (const row of zoneRows) {
    if (!zoneMap[row.groupId]) zoneMap[row.groupId] = [];
    zoneMap[row.groupId].push(row.zoneId);
  }

  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    color: g.color,
    description: g.description ?? undefined,
    zoneIds: zoneMap[g.id] ?? [],
    createdAt: g.createdAt,
    updatedAt: g.updatedAt,
  }));
}

// ─── Get Group ────────────────────────────────────────────────────────────────

export async function getGroup(db: Database, groupId: string): Promise<GroupWithZones | null> {
  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!group) return null;

  const zoneRows = await db
    .select()
    .from(groupZones)
    .where(eq(groupZones.groupId, groupId))
    .orderBy(groupZones.addedAt);

  return {
    id: group.id,
    name: group.name,
    color: group.color,
    description: group.description ?? undefined,
    zoneIds: zoneRows.map((z) => z.zoneId),
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    zones: zoneRows.map((z) => ({
      zoneId: z.zoneId,
      zoneName: z.zoneName,
      addedAt: z.addedAt,
    })),
  };
}

// ─── Create Group ─────────────────────────────────────────────────────────────

export async function createGroup(db: Database, data: CreateGroupInput): Promise<Group> {
  const id = nanoid();
  const now = new Date().toISOString();

  await db.insert(groups).values({
    id,
    name: data.name,
    color: data.color ?? "#6366f1",
    description: data.description ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db.select().from(groups).where(eq(groups.id, id)).limit(1);

  return {
    id: created.id,
    name: created.name,
    color: created.color,
    description: created.description ?? undefined,
    zoneIds: [],
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

// ─── Update Group ─────────────────────────────────────────────────────────────

export async function updateGroup(
  db: Database,
  groupId: string,
  data: UpdateGroupInput
): Promise<Group | null> {
  const [existing] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!existing) return null;

  const now = new Date().toISOString();

  await db
    .update(groups)
    .set({
      name: data.name ?? existing.name,
      color: data.color ?? existing.color,
      description: data.description !== undefined ? data.description : existing.description,
      updatedAt: now,
    })
    .where(eq(groups.id, groupId));

  const zoneRows = await db
    .select({ zoneId: groupZones.zoneId })
    .from(groupZones)
    .where(eq(groupZones.groupId, groupId));

  const [updated] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  return {
    id: updated.id,
    name: updated.name,
    color: updated.color,
    description: updated.description ?? undefined,
    zoneIds: zoneRows.map((z) => z.zoneId),
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

// ─── Delete Group ─────────────────────────────────────────────────────────────

export async function deleteGroup(db: Database, groupId: string): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);

  if (!existing) return false;

  // groupZones will cascade-delete because of the foreign key onDelete: "cascade"
  await db.delete(groups).where(eq(groups.id, groupId));

  return true;
}

// ─── Add Zones to Group ───────────────────────────────────────────────────────

export async function addZonesToGroup(
  db: Database,
  groupId: string,
  zones: AddZonesToGroupInput["zones"]
): Promise<void> {
  const now = new Date().toISOString();

  // Get existing zone IDs to avoid duplicates
  const existing = await db
    .select({ zoneId: groupZones.zoneId })
    .from(groupZones)
    .where(eq(groupZones.groupId, groupId));

  const existingZoneIds = new Set(existing.map((e) => e.zoneId));

  const toInsert = zones.filter((z) => !existingZoneIds.has(z.zoneId));

  if (toInsert.length === 0) return;

  await db.insert(groupZones).values(
    toInsert.map((z) => ({
      id: nanoid(),
      groupId,
      zoneId: z.zoneId,
      zoneName: z.zoneName,
      addedAt: now,
    }))
  );

  // Update group's updatedAt
  await db
    .update(groups)
    .set({ updatedAt: now })
    .where(eq(groups.id, groupId));
}

// ─── Remove Zones from Group ──────────────────────────────────────────────────

export async function removeZonesFromGroup(
  db: Database,
  groupId: string,
  zoneIds: string[]
): Promise<void> {
  if (zoneIds.length === 0) return;

  await db
    .delete(groupZones)
    .where(and(eq(groupZones.groupId, groupId), inArray(groupZones.zoneId, zoneIds)));

  // Update group's updatedAt
  const now = new Date().toISOString();
  await db
    .update(groups)
    .set({ updatedAt: now })
    .where(eq(groups.id, groupId));
}
