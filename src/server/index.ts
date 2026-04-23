import { Hono } from "hono";
import { logger } from "hono/logger";
import type { Bindings } from "./types/env";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { runAnalyticsBackfill } from "./services/analytics-backfill.service";
import health from "./routes/health";
import zones from "./routes/zones";
import dns from "./routes/dns";
import groups from "./routes/groups";
import security from "./routes/security";
import templates from "./routes/templates";
import analytics from "./routes/analytics";

export const app = new Hono<{ Bindings: Bindings }>();

// ─── Global Middleware ────────────────────────────────────────────────────────

// No CORS middleware: the Worker serves both the SPA (wrangler.jsonc
// `assets.directory`) and `/api/*` from the same origin, so browser requests
// never cross-origin. If a cross-origin consumer is ever introduced, mount
// `cors()` here with an explicit allowlist — not `origin: "*"`.

// Dev-only request logger; Workers has native request analytics in production.
const requestLogger = logger();
app.use("*", async (c, next) => {
  if (c.env.ENVIRONMENT !== "production") {
    return requestLogger(c, next);
  }
  return next();
});

// Auth middleware applied to all /api/* routes
app.use("/api/*", authMiddleware);

// ─── Routes ───────────────────────────────────────────────────────────────────

app.route("/api/health", health);
app.route("/api/zones", zones);
app.route("/api/dns", dns);
app.route("/api/groups", groups);
app.route("/api/security", security);
app.route("/api/templates", templates);
app.route("/api/analytics", analytics);

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

// ─── Workers Entry ────────────────────────────────────────────────────────────

export default {
  fetch: app.fetch,
  // Cron Trigger (see wrangler.jsonc `triggers.crons`).
  // Runs the analytics backfill; errors are logged into analytics_sync_log.
  scheduled: async (
    _controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ): Promise<void> => {
    ctx.waitUntil(
      runAnalyticsBackfill(env).catch((err) => {
        console.error("analytics backfill failed:", err);
      }),
    );
  },
} satisfies ExportedHandler<Bindings>;
