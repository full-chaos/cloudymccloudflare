import { Hono } from "hono";
import type { Bindings } from "../types/env";

const health = new Hono<{ Bindings: Bindings }>();

health.get("/", (c) => {
  return c.json({
    success: true,
    result: {
      status: "ok",
      version: "1.0.0",
      environment: c.env.ENVIRONMENT,
    },
  });
});

export default health;
