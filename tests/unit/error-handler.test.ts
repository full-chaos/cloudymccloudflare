import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "@server/middleware/errorHandler";
import { CloudflareApiError } from "@server/services/cloudflare";
import type { Bindings } from "@server/types/env";

function createApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.onError(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("handles CloudflareApiError with correct status", async () => {
    const app = createApp();
    app.get("/test", () => {
      throw new CloudflareApiError("Zone not found", 7003, 404);
    });

    const res = await app.request("/test");
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errors[0].message).toContain("Cloudflare API error");
  });

  it("handles CloudflareApiError with rate limit status", async () => {
    const app = createApp();
    app.get("/test", () => {
      throw new CloudflareApiError("Rate limited", 10000, 429);
    });

    const res = await app.request("/test");
    expect(res.status).toBe(429);
  });

  it("handles generic errors as 500", async () => {
    const app = createApp();
    app.get("/test", () => {
      throw new Error("Something went wrong");
    });

    const res = await app.request("/test");
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("masks generic errors in production", async () => {
    const app = createApp();
    app.get("/test", () => {
      throw new Error("database password leaked");
    });

    const res = await app.request("/test", {}, { ENVIRONMENT: "production" } as Bindings);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.errors[0].message).toBe("Internal Server Error");
  });

  it("handles CloudflareApiError with out-of-range status as 502", async () => {
    const app = createApp();
    app.get("/test", () => {
      throw new CloudflareApiError("Weird status", 0, 200);
    });

    const res = await app.request("/test");
    expect(res.status).toBe(502);
  });
});
