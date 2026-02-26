import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Bindings } from "../types/env";
import { createDb } from "../db";
import {
  createGroupSchema,
  updateGroupSchema,
  addZonesToGroupSchema,
  removeZonesFromGroupSchema,
} from "@shared/validators";
import {
  listGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  addZonesToGroup,
  removeZonesFromGroup,
} from "../services/group.service";
import { zValidator } from "../utils/zvalidator";

const groups = new Hono<{ Bindings: Bindings }>();

// GET /api/groups - list all groups
groups.get("/", async (c) => {
  const db = createDb(c.env.DB);
  const result = await listGroups(db);
  return c.json({ success: true, result });
});

// POST /api/groups - create group
groups.post("/", zValidator(createGroupSchema), async (c) => {
  const db = createDb(c.env.DB);
  const data = c.req.valid("json");
  const result = await createGroup(db, data);
  return c.json({ success: true, result }, 201);
});

// GET /api/groups/:groupId - get group detail with zones
groups.get("/:groupId", async (c) => {
  const { groupId } = c.req.param();
  const db = createDb(c.env.DB);

  const result = await getGroup(db, groupId);
  if (!result) {
    throw new HTTPException(404, { message: `Group ${groupId} not found` });
  }

  return c.json({ success: true, result });
});

// PUT /api/groups/:groupId - update group
groups.put("/:groupId", zValidator(updateGroupSchema), async (c) => {
  const { groupId } = c.req.param();
  const db = createDb(c.env.DB);
  const data = c.req.valid("json");

  const result = await updateGroup(db, groupId, data);
  if (!result) {
    throw new HTTPException(404, { message: `Group ${groupId} not found` });
  }

  return c.json({ success: true, result });
});

// DELETE /api/groups/:groupId - delete group
groups.delete("/:groupId", async (c) => {
  const { groupId } = c.req.param();
  const db = createDb(c.env.DB);

  const deleted = await deleteGroup(db, groupId);
  if (!deleted) {
    throw new HTTPException(404, { message: `Group ${groupId} not found` });
  }

  return c.json({ success: true, result: { deleted: true } });
});

// POST /api/groups/:groupId/zones - add zones to group
groups.post("/:groupId/zones", zValidator(addZonesToGroupSchema), async (c) => {
  const { groupId } = c.req.param();
  const db = createDb(c.env.DB);
  const { zones } = c.req.valid("json");

  // Verify group exists
  const group = await getGroup(db, groupId);
  if (!group) {
    throw new HTTPException(404, { message: `Group ${groupId} not found` });
  }

  await addZonesToGroup(db, groupId, zones);

  const updated = await getGroup(db, groupId);
  return c.json({ success: true, result: updated });
});

// DELETE /api/groups/:groupId/zones - remove zones from group
groups.delete("/:groupId/zones", zValidator(removeZonesFromGroupSchema), async (c) => {
  const { groupId } = c.req.param();
  const db = createDb(c.env.DB);
  const { zoneIds } = c.req.valid("json");

  // Verify group exists
  const group = await getGroup(db, groupId);
  if (!group) {
    throw new HTTPException(404, { message: `Group ${groupId} not found` });
  }

  await removeZonesFromGroup(db, groupId, zoneIds);

  const updated = await getGroup(db, groupId);
  return c.json({ success: true, result: updated });
});

export default groups;
