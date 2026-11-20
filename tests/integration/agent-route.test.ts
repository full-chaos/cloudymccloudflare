import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@server/middleware/cf-access", () => ({ verifyCfAccessJwt: vi.fn() }));
vi.mock("agents", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAgentByName: vi.fn(),
}));

import { getAgentByName } from "agents";
import { verifyCfAccessJwt } from "@server/middleware/cf-access";
import { agentInstanceName } from "@server/agent/route";
import { app } from "@server/index";

const agentFetch = vi.fn(async (_req: Request) => new Response("agent-ok"));
const ZoneAgent = { fake: true };

function prodEnv(over: Record<string, unknown> = {}) {
  return {
    ENVIRONMENT: "production",
    TEAM_DOMAIN: "https://team.cloudflareaccess.com",
    POLICY_AUD: "aud123",
    APP_SECRET: "secret123",
    CF_API_TOKEN: "",
    CF_ACCOUNT_ID: "",
    DB: {},
    ZoneAgent,
    ...over,
  };
}

function call(path: string, headers: Record<string, string> = {}, env = prodEnv(), base = "https://app.example.com") {
  return app.request(new Request(`${base}${path}`, { headers }), {}, env as never);
}

beforeEach(() => {
  vi.mocked(getAgentByName).mockReset();
  vi.mocked(getAgentByName).mockImplementation((async () => ({ fetch: agentFetch })) as never);
  agentFetch.mockClear();
  vi.mocked(verifyCfAccessJwt).mockReset();
});

describe("agentInstanceName", () => {
  it("is deterministic and well formed", async () => {
    const a = await agentInstanceName("alice@example.com");
    expect(a).toMatch(/^user-[0-9a-f]{32}$/);
    expect(await agentInstanceName("alice@example.com")).toBe(a);
    expect(await agentInstanceName("bob@example.com")).not.toBe(a);
  });
});

describe("/api/agent routing", () => {
  it("401s without auth", async () => {
    for (const p of ["/api/agent", "/api/agent/get-messages"]) {
      const res = await call(p);
      expect(res.status).toBe(401);
    }
    expect(getAgentByName).not.toHaveBeenCalled();
  });

  it("401s on invalid Access JWT", async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue(null);
    const res = await call("/api/agent", { "Cf-Access-Jwt-Assertion": "bad" });
    expect(res.status).toBe(401);
    expect(getAgentByName).not.toHaveBeenCalled();
  });

  it("routes a valid Access user to their lower-cased identity instance", async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: "Alice@Example.com" });
    const res = await call("/api/agent/get-messages", { "Cf-Access-Jwt-Assertion": "ok" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("agent-ok");
    expect(getAgentByName).toHaveBeenCalledWith(ZoneAgent, await agentInstanceName("alice@example.com"));
    expect(agentFetch).toHaveBeenCalledTimes(1);
  });

  it("gives different users different instances", async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValueOnce({ email: "a@x.com" });
    await call("/api/agent", { "Cf-Access-Jwt-Assertion": "ok" });
    vi.mocked(verifyCfAccessJwt).mockResolvedValueOnce({ email: "b@x.com" });
    await call("/api/agent", { "Cf-Access-Jwt-Assertion": "ok" });
    const names = vi.mocked(getAgentByName).mock.calls.map((c) => c[1]);
    expect(names).toHaveLength(2);
    expect(names[0]).not.toBe(names[1]);
  });

  it("ignores client-supplied name in query or path", async () => {
    vi.mocked(verifyCfAccessJwt).mockResolvedValue({ email: "alice@example.com" });
    const expected = await agentInstanceName("alice@example.com");
    for (const p of ["/api/agent?name=victim", "/api/agent/user-deadbeef/get-messages", "/api/agent/victim"]) {
      await call(p, { "Cf-Access-Jwt-Assertion": "ok" });
    }
    const names = vi.mocked(getAgentByName).mock.calls.map((c) => c[1]);
    expect(names).toEqual([expected, expected, expected]);
  });

  it("routes APP_SECRET bearer to the service-token instance", async () => {
    const res = await call("/api/agent", { Authorization: "Bearer secret123" });
    expect(res.status).toBe(200);
    expect(getAgentByName).toHaveBeenCalledWith(ZoneAgent, await agentInstanceName("service-token"));
  });

  it("routes localhost dev bypass to the local-dev instance", async () => {
    const res = await call(
      "/api/agent",
      {},
      prodEnv({ ENVIRONMENT: "development", ENABLE_DEV_AUTH_BYPASS: "true" }),
      "http://localhost:5173",
    );
    expect(res.status).toBe(200);
    expect(getAgentByName).toHaveBeenCalledWith(ZoneAgent, await agentInstanceName("local-dev"));
  });
});
