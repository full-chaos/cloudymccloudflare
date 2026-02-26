import type { MiddlewareHandler } from "hono";
import type { Bindings } from "../types/env";

export const authMiddleware: MiddlewareHandler<{ Bindings: Bindings }> = async (c, next) => {
  // Skip auth for health check endpoint
  const path = new URL(c.req.url).pathname;
  if (path === "/api/health") {
    return next();
  }

  // Skip auth in dev mode or when no APP_SECRET is configured
  const secret = c.env.APP_SECRET;
  if (!secret || secret === "your_app_secret_here") {
    return next();
  }

  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json(
      {
        success: false,
        errors: [{ code: 401, message: "Missing or invalid Authorization header" }],
      },
      401
    );
  }

  const token = authHeader.slice(7); // Remove "Bearer " prefix

  if (!token || token !== secret) {
    return c.json(
      {
        success: false,
        errors: [{ code: 401, message: "Invalid token" }],
      },
      401
    );
  }

  return next();
};
