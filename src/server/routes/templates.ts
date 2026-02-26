import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import type { Bindings } from "../types/env";
import { createDb, customTemplates } from "../db";
import { createTemplateSchema, updateTemplateSchema } from "@shared/validators";
import { RULE_TEMPLATES } from "@shared/constants";
import { zValidator } from "../utils/zvalidator";
import { nanoid } from "../utils/nanoid";
import type { RuleTemplate } from "@shared/types";

const templates = new Hono<{ Bindings: Bindings }>();

// GET /api/templates - list built-in + custom templates
templates.get("/", async (c) => {
  const db = createDb(c.env.DB);

  // Built-in templates from constants
  const builtIn = Object.entries(RULE_TEMPLATES).map(([id, tpl]) => ({
    id,
    name: tpl.name,
    description: tpl.description,
    expression: tpl.expression,
    action: tpl.action,
    category: tpl.category ?? "built-in",
    isBuiltIn: true,
    createdAt: null,
    updatedAt: null,
  }));

  // Custom templates from D1
  const custom = await db.select().from(customTemplates).orderBy(customTemplates.name);

  const customMapped = custom.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    expression: t.expression,
    action: t.action,
    category: t.category ?? "custom",
    isBuiltIn: false,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }));

  return c.json({ success: true, result: [...builtIn, ...customMapped] });
});

// GET /api/templates/:id - get template detail
templates.get("/:id", async (c) => {
  const { id } = c.req.param();
  const db = createDb(c.env.DB);

  // Check built-in first
  const builtIn = RULE_TEMPLATES[id];
  if (builtIn) {
    return c.json({
      success: true,
      result: {
        id,
        name: builtIn.name,
        description: builtIn.description,
        expression: builtIn.expression,
        action: builtIn.action,
        category: builtIn.category ?? "built-in",
        isBuiltIn: true,
        createdAt: null,
        updatedAt: null,
      },
    });
  }

  // Check custom templates in D1
  const [template] = await db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.id, id))
    .limit(1);

  if (!template) {
    throw new HTTPException(404, { message: `Template ${id} not found` });
  }

  return c.json({
    success: true,
    result: {
      id: template.id,
      name: template.name,
      description: template.description,
      expression: template.expression,
      action: template.action,
      category: template.category ?? "custom",
      isBuiltIn: false,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    },
  });
});

// POST /api/templates - create custom template
templates.post("/", zValidator(createTemplateSchema), async (c) => {
  const db = createDb(c.env.DB);
  const data = c.req.valid("json");

  const id = nanoid();
  const now = new Date().toISOString();

  await db.insert(customTemplates).values({
    id,
    name: data.name,
    description: data.description ?? "",
    expression: data.expression,
    action: data.action,
    category: data.category ?? null,
    createdAt: now,
    updatedAt: now,
  });

  const [created] = await db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.id, id))
    .limit(1);

  return c.json(
    {
      success: true,
      result: {
        id: created.id,
        name: created.name,
        description: created.description,
        expression: created.expression,
        action: created.action,
        category: created.category ?? "custom",
        isBuiltIn: false,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    },
    201
  );
});

// PUT /api/templates/:id - update custom template
templates.put("/:id", zValidator(updateTemplateSchema), async (c) => {
  const { id } = c.req.param();
  const db = createDb(c.env.DB);
  const data = c.req.valid("json");

  // Cannot update built-in templates
  if (RULE_TEMPLATES[id]) {
    throw new HTTPException(400, { message: "Cannot update built-in templates" });
  }

  const [existing] = await db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.id, id))
    .limit(1);

  if (!existing) {
    throw new HTTPException(404, { message: `Template ${id} not found` });
  }

  const now = new Date().toISOString();

  await db
    .update(customTemplates)
    .set({
      name: data.name ?? existing.name,
      description: data.description ?? existing.description,
      expression: data.expression ?? existing.expression,
      action: data.action ?? existing.action,
      category: data.category !== undefined ? data.category : existing.category,
      updatedAt: now,
    })
    .where(eq(customTemplates.id, id));

  const [updated] = await db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.id, id))
    .limit(1);

  return c.json({
    success: true,
    result: {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      expression: updated.expression,
      action: updated.action,
      category: updated.category ?? "custom",
      isBuiltIn: false,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    },
  });
});

// DELETE /api/templates/:id - delete custom template
templates.delete("/:id", async (c) => {
  const { id } = c.req.param();
  const db = createDb(c.env.DB);

  // Cannot delete built-in templates
  if (RULE_TEMPLATES[id]) {
    throw new HTTPException(400, { message: "Cannot delete built-in templates" });
  }

  const [existing] = await db
    .select()
    .from(customTemplates)
    .where(eq(customTemplates.id, id))
    .limit(1);

  if (!existing) {
    throw new HTTPException(404, { message: `Template ${id} not found` });
  }

  await db.delete(customTemplates).where(eq(customTemplates.id, id));

  return c.json({ success: true, result: { deleted: true } });
});

export default templates;
