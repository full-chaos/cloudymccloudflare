import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { authMiddleware } from "@server/middleware/auth";
import type { Bindings } from "@server/types/env";

function createApp(appSecret: string) {
  const app = new Hono<{ Bindings: Bindings }>();

  app.use("*", authMiddleware);

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.get("/api/zones", (c) => c.json({ zones: [] }));

  return app;
}

function makeRequest(path: string, headers: Record<string, string> = {}) {
  return new Request(`http://localhost${path}`, { headers });
}

describe("authMiddleware", () => {
  it("allows /api/health without auth", async () => {
    const app = createApp("secret123");
    const env = { APP_SECRET: "secret123" } as Bindings;
    const res = await app.request("/api/health", {}, env);
    expect(res.status).toBe(200);
  });

  it("blocks /api/zones without auth header when secret is set", async () => {
    const app = createApp("secret123");
    const env = { APP_SECRET: "secret123" } as Bindings;
    const res = await app.request("/api/zones", {}, env);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("blocks /api/zones with wrong token", async () => {
    const app = createApp("secret123");
    const env = { APP_SECRET: "secret123" } as Bindings;
    const res = await app.request(
      "/api/zones",
      { headers: { Authorization: "Bearer wrong" } },
      env
    );
    expect(res.status).toBe(401);
  });

  it("allows /api/zones with correct token", async () => {
    const app = createApp("secret123");
    const env = { APP_SECRET: "secret123" } as Bindings;
    const res = await app.request(
      "/api/zones",
      { headers: { Authorization: "Bearer secret123" } },
      env
    );
    expect(res.status).toBe(200);
  });

  it("bypasses auth when APP_SECRET is placeholder", async () => {
    const app = createApp("your_app_secret_here");
    const env = { APP_SECRET: "your_app_secret_here" } as Bindings;
    const res = await app.request("/api/zones", {}, env);
    expect(res.status).toBe(200);
  });

  it("bypasses auth when APP_SECRET is empty string", async () => {
    const app = createApp("");
    const env = { APP_SECRET: "" } as Bindings;
    const res = await app.request("/api/zones", {}, env);
    expect(res.status).toBe(200);
  });

  it("rejects non-Bearer auth schemes", async () => {
    const app = createApp("secret123");
    const env = { APP_SECRET: "secret123" } as Bindings;
    const res = await app.request(
      "/api/zones",
      { headers: { Authorization: "Basic dXNlcjpwYXNz" } },
      env
    );
    expect(res.status).toBe(401);
  });
});
