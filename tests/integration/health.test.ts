import { describe, it, expect } from "vitest";
// Default export was changed to `{fetch, scheduled}` for the Cron Trigger.
// Hono's `.request()` lives on the named `app` export now.
import { app } from "@server/index";

describe("GET /api/health", () => {
  it("returns 200 with status ok", async () => {
    const res = await app.request("/api/health", {}, {
      ENVIRONMENT: "test",
      APP_SECRET: "test-secret",
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.status).toBe("ok");
    expect(body.result.version).toBe("1.0.0");
    expect(body.result.environment).toBe("test");
  });

  it("does not require authentication", async () => {
    const res = await app.request("/api/health", {}, {
      ENVIRONMENT: "production",
      APP_SECRET: "real-secret",
    });

    expect(res.status).toBe(200);
  });
});
