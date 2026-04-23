import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "@server/middleware/auth";
import type { Bindings } from "@server/types/env";

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("*", authMiddleware);

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.get("/api/zones", (c) => c.json({ zones: [] }));

  return app;
}

function req(path: string, init?: RequestInit, baseUrl = "http://localhost") {
  return new Request(`${baseUrl}${path}`, init);
}

function env(overrides: Partial<Bindings> = {}): Bindings {
  return {
    APP_SECRET: "",
    ENVIRONMENT: "development",
    CF_API_TOKEN: "",
    CF_ACCOUNT_ID: "",
    DB: {} as D1Database,
    ...overrides,
  };
}

describe("authMiddleware", () => {
  it("allows /api/health without auth", async () => {
    const app = createApp();
    const res = await app.request(req("/api/health"), {}, env({ APP_SECRET: "secret123" }));
    expect(res.status).toBe(200);
  });

  it("allows /api/health without auth even in production", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/health"),
      {},
      env({ APP_SECRET: "secret123", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(200);
  });

  it("bypasses auth for localhost in local dev even when APP_SECRET is set", async () => {
    const app = createApp();
    const res = await app.request(req("/api/zones"), {}, env({ APP_SECRET: "secret123" }));
    expect(res.status).toBe(200);
  });

  it("bypasses auth for localhost even when ENVIRONMENT is production", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/zones"),
      {},
      env({ APP_SECRET: "secret123", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(200);
  });

  it("bypasses auth for private-network hosts even when ENVIRONMENT is production", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/zones", undefined, "http://192.168.4.82:5173"),
      {},
      env({ APP_SECRET: "secret123", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(200);
  });

  it("blocks non-local /api/zones without auth header when secret is set", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/zones", undefined, "https://example.com"),
      {},
      env({ APP_SECRET: "secret123", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("blocks non-local /api/zones with wrong token", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/zones", { headers: { Authorization: "Bearer wrong" } }, "https://example.com"),
      {},
      env({ APP_SECRET: "secret123", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(401);
  });

  it("allows non-local /api/zones with correct token in production", async () => {
    const app = createApp();
    const res = await app.request(
      req(
        "/api/zones",
        { headers: { Authorization: "Bearer secret123" } },
        "https://example.com"
      ),
      {},
      env({ APP_SECRET: "secret123", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(200);
  });

  it("bypasses auth in dev when APP_SECRET is placeholder", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/zones", undefined, "https://example.com"),
      {},
      env({ APP_SECRET: "your_app_secret_here", ENVIRONMENT: "development" })
    );
    expect(res.status).toBe(200);
  });

  it("bypasses auth in dev when APP_SECRET is empty string", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/zones", undefined, "https://example.com"),
      {},
      env({ APP_SECRET: "", ENVIRONMENT: "development" })
    );
    expect(res.status).toBe(200);
  });

  it("bypasses auth when ENVIRONMENT is unset and APP_SECRET is placeholder", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/zones", undefined, "https://example.com"),
      {},
      env({ APP_SECRET: "your_app_secret_here", ENVIRONMENT: "" })
    );
    expect(res.status).toBe(200);
  });

  it("fails closed in production when APP_SECRET is placeholder", async () => {
    const app = createApp();
    const res = await app.request(
      req("/api/zones", undefined, "https://example.com"),
      {},
      env({ APP_SECRET: "your_app_secret_here", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("fails closed in production when APP_SECRET is placeholder even with matching bearer", async () => {
    const app = createApp();
    const res = await app.request(
      req(
        "/api/zones",
        { headers: { Authorization: "Bearer your_app_secret_here" } },
        "https://example.com"
      ),
      {},
      env({ APP_SECRET: "your_app_secret_here", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(401);
  });

  it("fails closed in production when APP_SECRET is empty string", async () => {
    const app = createApp();
    const res = await app.request(
      req(
        "/api/zones",
        { headers: { Authorization: "Bearer anything" } },
        "https://example.com"
      ),
      {},
      env({ APP_SECRET: "", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(401);
  });

  it("rejects non-Bearer auth schemes", async () => {
    const app = createApp();
    const res = await app.request(
      req(
        "/api/zones",
        { headers: { Authorization: "Basic dXNlcjpwYXNz" } },
        "https://example.com"
      ),
      {},
      env({ APP_SECRET: "secret123", ENVIRONMENT: "production" })
    );
    expect(res.status).toBe(401);
  });
});
