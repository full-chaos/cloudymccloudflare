import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockD1 } from "../helpers/mock-db";
import { createMockCFClient, fakeRuleset } from "../helpers/mock-cf";

const cf = createMockCFClient();

vi.mock("@server/services/cloudflare", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@server/services/cloudflare")>()),
  CloudflareClient: function CloudflareClient() {
    return cf;
  },
}));

import { app } from "@server/index";

function makeEnv() {
  return {
    DB: createMockD1(),
    CF_API_TOKEN: "t",
    CF_ACCOUNT_ID: "a",
    APP_SECRET: "your_app_secret_here",
    ENVIRONMENT: "test",
    ENABLE_DEV_AUTH_BYPASS: "true",
  };
}

const rule = {
  id: "r1",
  action: "block",
  expression: "ip.src eq 1.1.1.1",
  description: "d",
  enabled: true,
};

const json = (body: unknown, method = "POST") => ({
  method,
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

describe("security API contract (client <-> server)", () => {
  beforeEach(() => {
    cf.getCustomWAFRules.mockReset();
    cf.setCustomWAFRules.mockReset();
  });

  it("GET /:zoneId/rules returns an array of rules", async () => {
    cf.getCustomWAFRules.mockResolvedValue(fakeRuleset({ rules: [rule] as never }));
    const res = await app.request("/api/security/z1/rules", {}, makeEnv());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.result)).toBe(true);
    expect(body.result[0].id).toBe("r1");
  });

  it("POST /:zoneId/rules accepts { rules: [] } and returns an array", async () => {
    cf.getCustomWAFRules.mockResolvedValue(fakeRuleset({ rules: [] }));
    cf.setCustomWAFRules.mockResolvedValue(fakeRuleset({ rules: [rule] as never }));
    const res = await app.request("/api/security/z1/rules", json({ rules: [rule] }), makeEnv());
    expect(res.status).toBe(201);
    expect(Array.isArray((await res.json()).result)).toBe(true);
  });

  it("DELETE /:zoneId/rules/:ruleId returns { deleted: true }", async () => {
    cf.getCustomWAFRules.mockResolvedValue(fakeRuleset({ rules: [rule] as never }));
    cf.setCustomWAFRules.mockResolvedValue(fakeRuleset({ rules: [] }));
    const res = await app.request("/api/security/z1/rules/r1", { method: "DELETE" }, makeEnv());
    expect(res.status).toBe(200);
    expect((await res.json()).result).toEqual({ deleted: true });
  });

  it("DELETE returns 404 for an unknown rule", async () => {
    cf.getCustomWAFRules.mockResolvedValue(fakeRuleset({ rules: [] }));
    const res = await app.request("/api/security/z1/rules/nope", { method: "DELETE" }, makeEnv());
    expect(res.status).toBe(404);
  });

  it("POST /deploy rejects a group target given ids instead of id", async () => {
    const res = await app.request(
      "/api/security/deploy",
      json({ target: { type: "group", ids: ["g1"] }, rules: [rule], mode: "append" }),
      makeEnv(),
    );
    expect(res.status).toBe(400);
  });
});
