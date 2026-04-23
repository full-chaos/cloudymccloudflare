import { Hono } from "hono";
import type { Bindings } from "../types/env";
import { isLocalDevHost } from "../middleware/auth";

const health = new Hono<{ Bindings: Bindings }>();

health.get("/", (c) => {
  const requestUrl = new URL(c.req.url);
  return c.json({
    success: true,
    result: {
      status: "ok",
      version: "1.0.0",
      environment: c.env.ENVIRONMENT,
      auth: {
        localBypassActive: isLocalDevHost(requestUrl.hostname),
        requestHost: requestUrl.host,
      },
    },
  });
});

export default health;
