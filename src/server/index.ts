import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Bindings } from "./types/env";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import health from "./routes/health";
import zones from "./routes/zones";
import dns from "./routes/dns";
import groups from "./routes/groups";
import security from "./routes/security";
import templates from "./routes/templates";

const app = new Hono<{ Bindings: Bindings }>();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length"],
    maxAge: 3600,
  })
);

app.use("*", logger());

// Auth middleware applied to all /api/* routes
app.use("/api/*", authMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route("/api/health", health);
app.route("/api/zones", zones);
app.route("/api/dns", dns);
app.route("/api/groups", groups);
app.route("/api/security", security);
app.route("/api/templates", templates);

// ─── 404 Handler ─────────────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json(
    {
      success: false,
      errors: [{ code: 404, message: `Route ${c.req.method} ${c.req.path} not found` }],
    },
    404
  );
});

// ─── Error Handler ────────────────────────────────────────────────────────────

app.onError(errorHandler);

export default app;
