import { describe, it, expect } from "vitest";
import { app } from "@server/index";
import { createMockD1 } from "../helpers/mock-db";

function makeEnv() {
  return {
    DB: createMockD1(),
    CF_API_TOKEN: "test-token",
    CF_ACCOUNT_ID: "acct-123",
    APP_SECRET: "your_app_secret_here", // bypasses auth
    ENVIRONMENT: "test",
    ENABLE_DEV_AUTH_BYPASS: "true",
  };
}

describe("GET /api/templates", () => {
  it("returns built-in templates", async () => {
    const env = makeEnv();
    // Mock the D1 query for custom templates to return empty
    const mockStmt = {
      bind: () => mockStmt,
      first: () => Promise.resolve(null),
      all: () => Promise.resolve({ results: [], success: true }),
      run: () => Promise.resolve({ success: true }),
      raw: () => Promise.resolve([]),
    };
    (env.DB.prepare as any).mockReturnValue(mockStmt);

    const res = await app.request("/api/templates", {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.result)).toBe(true);
    // Should have at least the 8 built-in templates
    expect(body.result.length).toBeGreaterThanOrEqual(8);

    // Verify built-in template structure
    const blockBadBots = body.result.find((t: any) => t.id === "block-bad-bots");
    expect(blockBadBots).toBeDefined();
    expect(blockBadBots.name).toBe("Block Known Bad Bots");
    expect(blockBadBots.isBuiltIn).toBe(true);
    expect(blockBadBots.action).toBe("block");
  });
});

describe("GET /api/templates/:id", () => {
  it("returns a built-in template by ID", async () => {
    const env = makeEnv();

    const res = await app.request("/api/templates/block-bad-bots", {}, env);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.name).toBe("Block Known Bad Bots");
    expect(body.result.isBuiltIn).toBe(true);
  });

  it("returns 404 for non-existent template", async () => {
    const env = makeEnv();
    const mockStmt = {
      bind: () => mockStmt,
      first: () => Promise.resolve(null),
      all: () => Promise.resolve({ results: [], success: true }),
      run: () => Promise.resolve({ success: true }),
      raw: () => Promise.resolve([]),
    };
    (env.DB.prepare as any).mockReturnValue(mockStmt);

    const res = await app.request("/api/templates/nonexistent-id", {}, env);
    expect(res.status).toBe(404);
  });
});
