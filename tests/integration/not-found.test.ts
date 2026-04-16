import { describe, it, expect } from "vitest";
import { app } from "@server/index";

describe("404 handler", () => {
  it("returns 404 JSON for unknown routes", async () => {
    const res = await app.request("/api/nonexistent", {}, {
      ENVIRONMENT: "test",
      APP_SECRET: "your_app_secret_here",
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.errors[0].code).toBe(404);
    expect(body.errors[0].message).toContain("not found");
  });

  it("includes method and path in error message", async () => {
    const res = await app.request("/api/does-not-exist", {
      method: "POST",
    }, {
      ENVIRONMENT: "test",
      APP_SECRET: "your_app_secret_here",
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.errors[0].message).toContain("POST");
    expect(body.errors[0].message).toContain("/api/does-not-exist");
  });
});
